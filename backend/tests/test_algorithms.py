"""Pure-Python tests (no database): run with `python -m unittest tests.test_algorithms`."""
import unittest
from decimal import Decimal

from common.scoring import score_attempt
from common.selection import reservoir_sample

QS = [{"id": i, "correct": 1, "marks": 2, "negative": "0.5"} for i in range(1, 5)]


class ScoringTests(unittest.TestCase):
    def test_mixed(self):
        s = score_attempt(QS, {1: 1, 2: 0, 3: None}, 40)   # 1 correct, 1 wrong, 2 unanswered
        self.assertEqual((s.correct, s.incorrect, s.unanswered), (1, 1, 2))
        self.assertEqual(s.obtained, Decimal("1.5"))
        self.assertEqual(s.total, Decimal("8"))
        self.assertEqual(s.percentage, Decimal("18.75"))
        self.assertFalse(s.passed)

    def test_never_negative(self):
        self.assertEqual(score_attempt(QS, {1: 0, 2: 0}, 40).obtained, Decimal("0"))

    def test_perfect_and_empty(self):
        self.assertTrue(score_attempt(QS, {i: 1 for i in range(1, 5)}, 100).passed)
        self.assertEqual(score_attempt([], {}, 40).percentage, Decimal("0"))

    def test_deterministic(self):
        a = {1: 1, 2: 1}
        self.assertEqual(score_attempt(QS, a, 40), score_attempt(QS, a, 40))


class SelectionTests(unittest.TestCase):
    def test_size_and_membership(self):
        s = reservoir_sample(range(1000), 20, seed=7)
        self.assertEqual(len(s), 20)
        self.assertEqual(len(set(s)), 20)
        self.assertTrue(all(0 <= x < 1000 for x in s))

    def test_reproducible(self):
        self.assertEqual(reservoir_sample(range(500), 10, seed=3), reservoir_sample(range(500), 10, seed=3))

    def test_small_population(self):
        self.assertEqual(sorted(reservoir_sample([1, 2, 3], 10)), [1, 2, 3])

    def test_roughly_uniform(self):
        counts = [0] * 10
        for seed in range(2000):
            for x in reservoir_sample(range(10), 3, seed=seed):
                counts[x] += 1
        self.assertTrue(all(500 < c < 700 for c in counts), counts)  # expected 600


if __name__ == "__main__":
    unittest.main()
