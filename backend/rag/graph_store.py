"""
Lightweight GraphRAG implementation.
Extracts entities and relationships from documents to enable multi-hop reasoning.
Stores knowledge graph in SQLite (no Neo4j dependency).
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import aiosqlite
import ollama

logger = logging.getLogger(__name__)

DB_PATH = Path("data/beastai.db")


@dataclass
class Entity:
    """A named entity in the knowledge graph."""
    name: str
    entity_type: str  # "person", "organization", "concept", "technology", etc.
    description: str = ""
    properties: Dict[str, str] = field(default_factory=dict)


@dataclass
class Relationship:
    """A relationship between two entities."""
    source: str
    target: str
    relation_type: str  # "works_for", "uses", "related_to", "part_of", etc.
    description: str = ""
    weight: float = 1.0


@dataclass
class GraphSearchResult:
    """Result from a graph-based search."""
    entities: List[Entity]
    relationships: List[Relationship]
    context: str  # Generated context from graph traversal


class KnowledgeGraph:
    """SQLite-backed knowledge graph for GraphRAG."""

    def __init__(
        self,
        db_path: str | Path = DB_PATH,
        ollama_client: Optional[ollama.Client] = None,
        extraction_model: str = "qwen3:8b",
    ):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.client = ollama_client or ollama.Client()
        self.extraction_model = extraction_model
        self._initialized = False

    async def _ensure_tables(self):
        if self._initialized:
            return
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS entities (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    entity_type TEXT NOT NULL,
                    description TEXT DEFAULT '',
                    properties TEXT DEFAULT '{}',
                    created_at INTEGER NOT NULL
                )
            """)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS relationships (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source TEXT NOT NULL,
                    target TEXT NOT NULL,
                    relation_type TEXT NOT NULL,
                    description TEXT DEFAULT '',
                    weight REAL DEFAULT 1.0,
                    created_at INTEGER NOT NULL,
                    UNIQUE(source, target, relation_type)
                )
            """)
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_entity_name ON entities(name)"
            )
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_rel_source ON relationships(source)"
            )
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_rel_target ON relationships(target)"
            )
            await db.commit()
        self._initialized = True

    async def extract_and_store(self, text: str, source: str = "") -> Dict[str, int]:
        """
        Extract entities and relationships from text using LLM, then store in graph.

        Returns:
            Dict with counts of entities and relationships added.
        """
        entities, relationships = await self._extract_from_text(text)

        entities_added = 0
        rels_added = 0

        await self._ensure_tables()
        now = int(time.time() * 1000)

        async with aiosqlite.connect(self.db_path) as db:
            for entity in entities:
                try:
                    await db.execute(
                        """INSERT INTO entities (name, entity_type, description, properties, created_at)
                           VALUES (?, ?, ?, ?, ?)
                           ON CONFLICT(name) DO UPDATE SET
                               description = CASE WHEN length(excluded.description) > length(entities.description)
                                   THEN excluded.description ELSE entities.description END""",
                        (entity.name, entity.entity_type, entity.description,
                         json.dumps(entity.properties), now),
                    )
                    entities_added += 1
                except Exception as e:
                    logger.debug(f"Entity insert error: {e}")

            for rel in relationships:
                try:
                    await db.execute(
                        """INSERT INTO relationships (source, target, relation_type, description, weight, created_at)
                           VALUES (?, ?, ?, ?, ?, ?)
                           ON CONFLICT(source, target, relation_type) DO UPDATE SET
                               weight = relationships.weight + 0.1""",
                        (rel.source, rel.target, rel.relation_type,
                         rel.description, rel.weight, now),
                    )
                    rels_added += 1
                except Exception as e:
                    logger.debug(f"Relationship insert error: {e}")

            await db.commit()

        logger.info(f"GraphRAG: extracted {entities_added} entities, {rels_added} relationships")
        return {"entities_added": entities_added, "relationships_added": rels_added}

    async def search(
        self,
        query: str,
        max_hops: int = 2,
        max_entities: int = 10,
    ) -> GraphSearchResult:
        """
        Search the knowledge graph starting from entities mentioned in the query.
        Performs multi-hop traversal to find related context.
        """
        await self._ensure_tables()

        # Find seed entities (mentioned in query)
        seed_entities = await self._find_matching_entities(query)

        if not seed_entities:
            return GraphSearchResult(entities=[], relationships=[], context="")

        # BFS traversal up to max_hops
        visited: Set[str] = set()
        all_entities: List[Entity] = []
        all_relationships: List[Relationship] = []
        frontier = [e.name for e in seed_entities]

        for hop in range(max_hops):
            next_frontier = []
            for entity_name in frontier:
                if entity_name in visited:
                    continue
                visited.add(entity_name)

                # Get relationships from this entity
                rels = await self._get_relationships(entity_name)
                all_relationships.extend(rels)

                for rel in rels:
                    neighbor = rel.target if rel.source == entity_name else rel.source
                    if neighbor not in visited:
                        next_frontier.append(neighbor)
                        # Fetch neighbor entity info
                        entity = await self._get_entity(neighbor)
                        if entity:
                            all_entities.append(entity)

            frontier = next_frontier[:max_entities]

        # Combine seed + traversed entities
        all_entities = seed_entities + all_entities

        # Generate context string
        context = self._build_context(all_entities, all_relationships)

        return GraphSearchResult(
            entities=all_entities[:max_entities],
            relationships=all_relationships,
            context=context,
        )

    async def _extract_from_text(
        self, text: str
    ) -> Tuple[List[Entity], List[Relationship]]:
        """Use LLM to extract entities and relationships from text."""
        # Truncate long text
        text = text[:3000]

        prompt = f"""Extract entities and relationships from this text. Return valid JSON only.

Text: {text}

Return JSON with this exact structure:
{{
  "entities": [
    {{"name": "Entity Name", "type": "person|organization|concept|technology|place|event", "description": "brief description"}}
  ],
  "relationships": [
    {{"source": "Entity A", "target": "Entity B", "type": "works_for|uses|related_to|part_of|created|influences", "description": "brief description"}}
  ]
}}

JSON:"""

        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.client.chat(
                    model=self.extraction_model,
                    messages=[{"role": "user", "content": prompt}],
                    options={"temperature": 0.1, "num_predict": 1000},
                ),
            )

            content = response.get("message", {}).get("content", "")

            # Extract JSON
            json_match = content
            if "{" in content:
                start = content.index("{")
                end = content.rindex("}") + 1
                json_match = content[start:end]

            data = json.loads(json_match)

            entities = [
                Entity(
                    name=e["name"],
                    entity_type=e.get("type", "concept"),
                    description=e.get("description", ""),
                )
                for e in data.get("entities", [])
            ]

            relationships = [
                Relationship(
                    source=r["source"],
                    target=r["target"],
                    relation_type=r.get("type", "related_to"),
                    description=r.get("description", ""),
                )
                for r in data.get("relationships", [])
            ]

            return entities, relationships

        except Exception as e:
            logger.warning(f"Entity extraction failed: {e}")
            return [], []

    async def _find_matching_entities(self, query: str) -> List[Entity]:
        """Find entities mentioned in the query."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row

            # Split query into words and search for matches
            words = set(query.lower().split())
            entities = []

            cursor = await db.execute(
                """SELECT * FROM entities
                   ORDER BY created_at DESC LIMIT 200"""
            )
            rows = await cursor.fetchall()

            for row in rows:
                name_lower = row["name"].lower()
                # Check if entity name appears in query (fuzzy)
                if name_lower in query.lower() or any(
                    w in name_lower for w in words if len(w) > 3
                ):
                    entities.append(Entity(
                        name=row["name"],
                        entity_type=row["entity_type"],
                        description=row["description"],
                    ))

            return entities[:10]

    async def _get_relationships(self, entity_name: str) -> List[Relationship]:
        """Get all relationships for an entity."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """SELECT * FROM relationships
                   WHERE source = ? OR target = ?
                   ORDER BY weight DESC LIMIT 20""",
                (entity_name, entity_name),
            )
            rows = await cursor.fetchall()
            return [
                Relationship(
                    source=r["source"],
                    target=r["target"],
                    relation_type=r["relation_type"],
                    description=r["description"],
                    weight=r["weight"],
                )
                for r in rows
            ]

    async def _get_entity(self, name: str) -> Optional[Entity]:
        """Get a single entity by name."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM entities WHERE name = ?", (name,)
            )
            row = await cursor.fetchone()
            if row:
                return Entity(
                    name=row["name"],
                    entity_type=row["entity_type"],
                    description=row["description"],
                )
            return None

    def _build_context(
        self,
        entities: List[Entity],
        relationships: List[Relationship],
    ) -> str:
        """Build a textual context from graph data for LLM consumption."""
        if not entities and not relationships:
            return ""

        parts = ["Knowledge graph context:"]

        if entities:
            parts.append("\nEntities:")
            for e in entities[:15]:
                desc = f" — {e.description}" if e.description else ""
                parts.append(f"- {e.name} ({e.entity_type}){desc}")

        if relationships:
            parts.append("\nRelationships:")
            for r in relationships[:20]:
                desc = f" ({r.description})" if r.description else ""
                parts.append(f"- {r.source} --[{r.relation_type}]--> {r.target}{desc}")

        return "\n".join(parts)

    async def get_stats(self) -> Dict[str, int]:
        """Get graph statistics."""
        await self._ensure_tables()
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute("SELECT COUNT(*) FROM entities")
            entity_count = (await cursor.fetchone())[0]
            cursor = await db.execute("SELECT COUNT(*) FROM relationships")
            rel_count = (await cursor.fetchone())[0]
        return {"entities": entity_count, "relationships": rel_count}
