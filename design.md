---
name: Academic Default
colors:
  bg: "#ffffff"
  surface: "#f8fafc"
  primary: "#1a1a2e"
  accent: "#2563eb"
  text: "#1e293b"
  text-muted: "#64748b"
  border: "#e2e8f0"
  link: "#2563eb"
typography:
  font-family: "'Hiragino Kaku Gothic ProN', 'ヒラギノ角ゴ ProN W3', 'Noto Sans JP', system-ui, sans-serif"
  font-size-base: "16px"
  line-height: "1.7"
rounded:
  sm: "6px"
  md: "12px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "32px"
  lg: "64px"
  section: "80px"
---

# design.md — デザイン設定ファイル

上の `---` で囲まれた部分を編集するとサイトのデザインが変わります。
git push するだけで即反映されます（ビルド不要）。

## 別デザインに切り替える例

**BZ Vermillion（黒背景・白文字）にする場合：**

```yaml
colors:
  bg: "#000000"
  surface: "#000000"
  primary: "#ffffff"
  accent: "#0000EE"
  text: "#ffffff"
  text-muted: "#9ca3af"
  border: "#374151"
  link: "#0000EE"
```
