## 2024-05-23 - Custom Checkbox Component
**Learning:** Using native `input type="checkbox"` in a design-system driven app creates visual inconsistency and limits accessibility customization. Radix UI's Checkbox primitive automatically handles hidden inputs for form submission when a `name` prop is provided.
**Action:** Always prefer creating a `Checkbox` component wrapper around Radix UI primitives rather than styling raw inputs, to ensure consistent focus states and theme integration.
