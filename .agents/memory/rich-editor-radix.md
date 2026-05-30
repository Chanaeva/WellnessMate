---
name: Rich-text editor in Radix Dialog
description: How to correctly use a contenteditable div inside a Radix UI Dialog without cursor/backwards-typing bugs
---

## Rules

1. **Stop key propagation** on the contenteditable div: add `onKeyDown/onKeyUp/onKeyPress={(e) => e.stopPropagation()}`. Radix Dialog's focus trap intercepts keystrokes otherwise, making typing impossible.

2. **Never use `dangerouslySetInnerHTML`** on a contenteditable element. React resets the cursor to position 0 on every re-render, causing text to appear backwards.

3. **Seed innerHTML once via a mount-only `useEffect`**: capture `initialHtml` in a `useRef` *before* the effect, then set `editorRef.current.innerHTML = mountRef.current` inside `useEffect(() => {...}, [])` (empty deps). This runs exactly once per mount.

4. **Do not track the live parent state as `initialHtml`**: if the parent passes a reactive state variable (e.g. `htmlBody`) as the prop, the prop changes on every keystroke, which re-triggers any effect that depends on it and resets the cursor. Use `editorKey` (remounting the component) to switch drafts instead.

**Why:** React owns the virtual DOM; for contenteditable the browser owns the DOM. Mixing React's reconciliation with direct DOM edits causes cursor corruption. The pattern above hands full control to the browser after seeding the initial value.

**How to apply:** Any time a contenteditable rich-text editor lives inside a Radix Dialog (or any focus-trapping container).
