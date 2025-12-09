from enum import Enum
from typing import Optional, Dict, Any
import re
from dataclasses import dataclass


class TaskType(str, Enum):
    """Task types for model routing."""
    SIMPLE_CHAT = "simple_chat"
    GENERAL = "general"
    REASONING = "reasoning"
    CODING = "coding"
    VISION = "vision"
    CREATIVE = "creative"


@dataclass
class ClassificationResult:
    """Result of query classification."""
    task_type: TaskType
    confidence: float
    complexity_score: float
    keywords_found: list[str]
    reasoning: str


class QueryClassifier:
    """Classifies queries to determine optimal model routing."""

    # Keywords and patterns for different task types
    # REASONING has strong indicators that override other classifications
    REASONING_PATTERNS = [
        r'\b(why|how|what if|explain|analyze|compare|step.by.step)\b',
        r'\b(think|reason|prove|derive|understand|comprehend)\b',
        r'\b(cause|effect|relationship|correlation|implication)\b',
        r'\b(theory|concept|principle|framework|paradigm)\b',
        r'\b(advantage|disadvantage|benefit|drawback|trade.off)\b',
        r'\b(alternative|option|choice|decision|strategy)\b',
        r'\b(deep|thorough|detailed|comprehensive|in.depth)\b',  # Deep analysis keywords
        r'\b(evaluate|assess|critique|review|examine)\b',
        r'\b(logical|systematic|methodical|analytical)\b',
        r'\b(implications?|consequences?|ramifications?)\b'
    ]
    
    # Strong reasoning indicators that should override other patterns
    STRONG_REASONING_PHRASES = [
        r'deep\s+(analysis|dive|look|examination)',
        r'(analyze|explain|examine)\s+(in\s+detail|thoroughly|carefully)',
        r'step\s+by\s+step',
        r'think\s+(through|about|carefully)',
        r'break\s+(down|it\s+down)',
        r'pros?\s+and\s+cons?',
        r'(weigh|consider)\s+(the\s+)?(options?|alternatives?)',
    ]

    CODING_PATTERNS = [
        r'\b(code|function|class|method|variable|algorithm)\b',
        r'\b(python|javascript|java|c\+\+|rust|go|typescript)\b',
        r'\b(debug|error|exception|bug|fix|issue|problem)\b',
        r'\b(api|library|framework|package|module|import)\b',
        r'\b(database|sql|query|table|schema|migration)\b',
        r'```[\w]*\n',  # Code blocks
        r'\b(git|github|repository|commit|branch|merge)\b'
    ]

    CREATIVE_PATTERNS = [
        r'\b(write|create|design|generate|imagine|story)\b',
        r'\b(artistic|creative|original|innovative|unique)\b',
        r'\b(brainstorm|ideate|conceptualize|visualize)\b',
        r'\b(marketing|advertising|brand|campaign|content)\b',
        r'\b(poem|story|novel|script|lyrics|music)\b'
    ]

    VISION_PATTERNS = [
        r'\b(image|photo|picture|visual|graphic|artwork)\b',
        r'\b(describe|analyze|identify|recognize|detect)\b',
        r'\b(color|shape|size|texture|pattern|layout)\b',
        r'\b(see|look|appear|visible|display|show)\b'
    ]

    def __init__(self):
        """Initialize classifier with compiled regex patterns."""
        self.reasoning_regex = re.compile(
            '|'.join(self.REASONING_PATTERNS),
            re.IGNORECASE
        )
        self.strong_reasoning_regex = re.compile(
            '|'.join(self.STRONG_REASONING_PHRASES),
            re.IGNORECASE
        )
        self.coding_regex = re.compile(
            '|'.join(self.CODING_PATTERNS),
            re.IGNORECASE
        )
        self.creative_regex = re.compile(
            '|'.join(self.CREATIVE_PATTERNS),
            re.IGNORECASE
        )
        self.vision_regex = re.compile(
            '|'.join(self.VISION_PATTERNS),
            re.IGNORECASE
        )

    def classify(
        self,
        query: str,
        has_images: bool = False,
        context_length: int = 0,
        conversation_history: Optional[list] = None
    ) -> ClassificationResult:
        """Classify a query into a task type with confidence scores."""

        query_lower = query.lower()
        word_count = len(query.split())

        # Vision takes priority if images are present
        if has_images:
            vision_matches = len(self.vision_regex.findall(query))
            if vision_matches > 0:
                return ClassificationResult(
                    task_type=TaskType.VISION,
                    confidence=0.95,
                    complexity_score=self._calculate_complexity(query),
                    keywords_found=self.vision_regex.findall(query),
                    reasoning="Images detected with vision-related keywords"
                )

        # Check for STRONG reasoning phrases first (before coding)
        # These override other classifications because the user explicitly wants analysis
        strong_reasoning_matches = self.strong_reasoning_regex.findall(query)
        if strong_reasoning_matches:
            return ClassificationResult(
                task_type=TaskType.REASONING,
                confidence=0.95,
                complexity_score=self._calculate_complexity(query),
                keywords_found=strong_reasoning_matches,
                reasoning=f"Strong reasoning phrase detected: {strong_reasoning_matches[0]}"
            )

        # Check for code blocks (definite coding task)
        if '```' in query:
            coding_matches = len(self.coding_regex.findall(query))
            return ClassificationResult(
                task_type=TaskType.CODING,
                confidence=0.95,
                complexity_score=self._calculate_complexity(query),
                keywords_found=self.coding_regex.findall(query),
                reasoning="Code block detected"
            )

        # Score both coding and reasoning patterns
        coding_matches = self.coding_regex.findall(query)
        reasoning_matches = self.reasoning_regex.findall(query)
        
        coding_score = len(coding_matches)
        reasoning_score = len(reasoning_matches)
        
        # If both have matches, pick the stronger one
        if coding_score > 0 and reasoning_score > 0:
            if reasoning_score >= coding_score:
                # Reasoning wins or ties (analysis of code = reasoning about code)
                confidence = min(0.9, 0.5 + (reasoning_score * 0.1))
                return ClassificationResult(
                    task_type=TaskType.REASONING,
                    confidence=confidence,
                    complexity_score=self._calculate_complexity(query),
                    keywords_found=reasoning_matches,
                    reasoning=f"Reasoning ({reasoning_score}) >= Coding ({coding_score})"
                )
            else:
                # Coding wins
                confidence = min(0.9, 0.5 + (coding_score * 0.1))
                return ClassificationResult(
                    task_type=TaskType.CODING,
                    confidence=confidence,
                    complexity_score=self._calculate_complexity(query),
                    keywords_found=coding_matches,
                    reasoning=f"Coding ({coding_score}) > Reasoning ({reasoning_score})"
                )

        # Pure coding patterns
        if coding_score > 0:
            confidence = min(0.9, 0.5 + (coding_score * 0.1))
            return ClassificationResult(
                task_type=TaskType.CODING,
                confidence=confidence,
                complexity_score=self._calculate_complexity(query),
                keywords_found=coding_matches,
                reasoning=f"Found {coding_score} coding-related keywords"
            )

        # Pure reasoning patterns
        if reasoning_score > 0:
            confidence = min(0.85, 0.4 + (reasoning_score * 0.1))
            return ClassificationResult(
                task_type=TaskType.REASONING,
                confidence=confidence,
                complexity_score=self._calculate_complexity(query),
                keywords_found=reasoning_matches,
                reasoning=f"Found {reasoning_score} reasoning-related keywords"
            )

        # Check for creative tasks
        if self.creative_regex.search(query):
            creative_matches = len(self.creative_regex.findall(query))
            confidence = min(0.8, 0.3 + (creative_matches * 0.1))
            return ClassificationResult(
                task_type=TaskType.CREATIVE,
                confidence=confidence,
                complexity_score=self._calculate_complexity(query),
                keywords_found=self.creative_regex.findall(query),
                reasoning=f"Found {creative_matches} creative-related keywords"
            )

        # Heuristic-based classification for simple vs general queries
        complexity = self._calculate_complexity(query)

        # Very short queries are likely simple chat
        if word_count < 10 and complexity < 0.3:
            return ClassificationResult(
                task_type=TaskType.SIMPLE_CHAT,
                confidence=0.7,
                complexity_score=complexity,
                keywords_found=[],
                reasoning=f"Short query ({word_count} words) with low complexity"
            )

        # Default to general
        return ClassificationResult(
            task_type=TaskType.GENERAL,
            confidence=0.6,
            complexity_score=complexity,
            keywords_found=[],
            reasoning="Default classification - general conversation"
        )

    def _calculate_complexity(self, query: str) -> float:
        """Calculate query complexity score from 0.0 to 1.0."""
        factors = []

        # Length factor (longer queries tend to be more complex)
        word_count = len(query.split())
        factors.append(min(word_count / 100, 1.0))

        # Question complexity
        question_indicators = len(re.findall(r'\b(why|how|what|when|where|who|which)\b', query.lower()))
        factors.append(min(question_indicators / 5, 1.0))

        # Technical/specialized terms (rough heuristic)
        technical_pattern = r'\b[A-Z][a-z]+[A-Z]|\b\w{8,}\b'  # CamelCase or long words
        technical_count = len(re.findall(technical_pattern, query))
        factors.append(min(technical_count / 10, 1.0))

        # Punctuation complexity
        punctuation_count = len(re.findall(r'[?!;:]', query))
        factors.append(min(punctuation_count / 10, 1.0))

        return sum(factors) / len(factors) if factors else 0.0

    def get_model_recommendation(self, classification: ClassificationResult) -> Dict[str, Any]:
        """Get model recommendation based on classification."""

        recommendations = {
            TaskType.SIMPLE_CHAT: {
                "model": "qwen3:4b",
                "reason": "Fast responses for simple queries",
                "expected_speed": "50+ tok/s",
                "max_tokens": 4096
            },
            TaskType.GENERAL: {
                "model": "qwen3:8b",
                "reason": "Balanced quality and speed for general tasks",
                "expected_speed": "35+ tok/s",
                "max_tokens": 8192
            },
            TaskType.REASONING: {
                "model": "deepseek-r1:8b",
                "reason": "Advanced reasoning for complex analytical tasks",
                "expected_speed": "25+ tok/s",
                "max_tokens": 16384
            },
            TaskType.CODING: {
                "model": "qwen2.5-coder:7b",
                "reason": "Specialized coding model with programming expertise",
                "expected_speed": "35+ tok/s",
                "max_tokens": 8192
            },
            TaskType.VISION: {
                "model": "llava:7b",
                "reason": "Vision-capable model for image analysis",
                "expected_speed": "25+ tok/s",
                "max_tokens": 4096
            },
            TaskType.CREATIVE: {
                "model": "qwen3:8b",
                "reason": "Creative tasks benefit from larger context window",
                "expected_speed": "35+ tok/s",
                "max_tokens": 8192
            }
        }

        base_rec = recommendations.get(classification.task_type, recommendations[TaskType.GENERAL])

        # Upgrade to reasoning model for high complexity general queries
        if (classification.task_type == TaskType.GENERAL and
            classification.complexity_score > 0.6):
            base_rec = recommendations[TaskType.REASONING].copy()
            base_rec["reason"] += " (upgraded due to high complexity)"

        return {
            **base_rec,
            "task_type": classification.task_type.value,
            "confidence": classification.confidence,
            "complexity": classification.complexity_score,
            "keywords": [str(kw) for kw in classification.keywords_found[:5]]  # Limit keywords and convert to strings
        }
