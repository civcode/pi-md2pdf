# Mermaid rendering probe

Math remains supported: $E = mc^2$.

## Flowchart

```mermaid
flowchart LR
  A[Markdown] --> B[Renderer]
  B --> C[PDF]
```

## Sequence

```mermaid
sequenceDiagram
  participant Pi
  participant Renderer
  Pi->>Renderer: Convert document
  Renderer-->>Pi: PDF
```

## Class diagram

```mermaid
classDiagram
  Document --> Diagram
  class Document {
    +String filename
  }
  class Diagram {
    +render()
  }
```

## Entity relationship

```mermaid
erDiagram
  DOCUMENT ||--o{ DIAGRAM : contains
```

## State

```mermaid
stateDiagram-v2
  [*] --> Parsing
  Parsing --> Rendering
  Rendering --> Complete
  Complete --> [*]
```

## Gantt

```mermaid
gantt
  title Project
  dateFormat YYYY-MM-DD
  section Render
  Parse :a, 2026-01-01, 2d
  Print :after a, 1d
```

## Pie

```mermaid
pie showData
  title Document types
  "Markdown" : 70
  "Other" : 30
```

## Ordinary code remains literal

```text
flowchart LR
  A --> B
```
