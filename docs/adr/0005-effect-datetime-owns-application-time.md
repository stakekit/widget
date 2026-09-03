# Effect DateTime owns application time

Application instants use Effect `DateTime`, intervals use `Duration`, and current
time comes from `Clock` or `DateTime.now`. A single time model keeps arithmetic,
serialization, tests, and injected time consistent.
