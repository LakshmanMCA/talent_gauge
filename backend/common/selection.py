"""Random question selection without ORDER BY RANDOM().
Fetch candidate ids only (index-only scan), then reservoir-sample:
O(N) time, O(k) memory, seedable for reproducible blueprints."""
import random


def reservoir_sample(ids, k, seed=None):
    rng = random.Random(seed)
    sample = []
    for i, x in enumerate(ids):
        if i < k:
            sample.append(x)
        else:
            j = rng.randint(0, i)
            if j < k:
                sample[j] = x
    return sample
