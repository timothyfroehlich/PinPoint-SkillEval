## 2024-05-22 - Improved Password Strength Accessibility
**Learning:** For visual meters like password strength indicators, use `role="meter"` along with `aria-valuenow`, `aria-valuemin`, and `aria-valuemax` to communicate status to screen readers.
**Action:** Always complement visual progress/strength bars with `role="meter"` and `aria-valuetext` to provide context (e.g., "Strong") rather than just a number. Hide redundant text labels with `aria-hidden="true"`.
