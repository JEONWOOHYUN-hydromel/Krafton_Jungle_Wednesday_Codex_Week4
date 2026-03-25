# Virtual DOM Playground

Vanilla JavaScript로 만든 Virtual DOM / Diff / Patch 과제용 프로젝트입니다.  
브라우저 DOM을 Virtual DOM으로 변환하고, 이전 상태와 새 상태를 비교해서 변경된 부분만 실제 DOM에 반영합니다.

## 폴더 구조

```text
project-root/
├── index.html
├── package.json
├── src/
│   ├── app.js
│   ├── diff/
│   │   └── diff.js
│   ├── patch/
│   │   └── patch.js
│   ├── utils/
│   │   └── helpers.js
│   └── vdom/
│       ├── domToVdom.js
│       └── renderVdom.js
├── styles/
│   └── style.css
└── README.md
```

## 구현 범위

- `src/vdom/domToVdom.js`
  - 실제 DOM 또는 HTML 문자열을 Virtual DOM 트리로 변환합니다.
- `src/vdom/renderVdom.js`
  - Virtual DOM을 실제 DOM 노드로 렌더링합니다.
- `src/diff/diff.js`
  - 이전 VDOM과 새 VDOM을 비교해서 patch 목록을 생성합니다.
- `src/patch/patch.js`
  - patch 목록을 실제 DOM에 적용합니다.
- `src/app.js`
  - 페이지 초기화, Patch / Undo / Redo, history, patch 로그 UI를 담당합니다.
- `src/utils/helpers.js`
  - key 처리, path 포맷, patch 설명, VDOM 직렬화 유틸을 제공합니다.

## 현재 동작 방식

1. 페이지 로드 시 실제 영역의 샘플 DOM을 읽어 Virtual DOM으로 변환합니다.
2. 같은 VDOM을 테스트 영역 미리보기와 HTML Editor에 반영합니다.
3. 사용자가 HTML Editor에서 코드를 수정합니다.
4. `Patch` 버튼을 누르면:
   - 현재 HTML을 새 Virtual DOM으로 변환합니다.
   - 이전 VDOM과 새 VDOM을 비교해서 patch 목록을 만듭니다.
   - patch만 실제 영역에 적용합니다.
   - 새 상태를 history에 저장합니다.
5. `Undo`, `Redo` 버튼으로 저장된 VDOM snapshot을 다시 렌더링합니다.

## Diff 알고리즘의 핵심 케이스

- `CREATE`
  - 새 노드가 추가된 경우
- `REMOVE`
  - 기존 노드가 삭제된 경우
- `REPLACE`
  - 노드 타입이나 태그명이 바뀐 경우
- `TEXT`
  - 텍스트만 바뀐 경우
- `PROPS`
  - 속성(attribute)만 바뀐 경우
- `REORDER`
  - 같은 부모 아래 keyed 자식들의 순서나 구성이 바뀐 경우

## keyed diff 기준

이 프로젝트는 형제 노드 전부가 `key` 또는 `data-key` 속성을 가질 때 keyed diff를 사용합니다.

예시:

```html
<ul>
  <li data-key="dom">DOM to VDOM</li>
  <li data-key="diff">Keyed reconciliation</li>
  <li data-key="patch">Selective DOM update</li>
</ul>
```

이 상태에서 순서를 바꾸면 index 기반 비교 대신 key 기반 비교를 사용합니다.  
같은 keyed 형제 집합 안에서 항목이 추가되거나 삭제되는 경우도 부모 레벨의 `REORDER` patch로 처리합니다.  
형제 중 일부만 key를 가지거나 text node가 섞인 경우에는 현재 구현상 index 기반 비교로 fallback 됩니다.

## 실행 방법

### 가장 간단한 방법

`index.html` 파일을 브라우저에서 직접 열면 됩니다.

### 로컬 서버로 실행

정적 서버를 띄워서 실행해도 됩니다.

```bash
python -m http.server 5500
```

이후 브라우저에서 `http://localhost:5500` 으로 접속합니다.

## 시연 순서 추천

발표나 과제 시연은 아래 순서로 진행하면 흐름이 깔끔합니다.

1. 초기 화면 설명
   - 왼쪽은 실제 영역, 오른쪽은 테스트 영역 + HTML Editor 입니다.
   - 페이지 로드 시 실제 DOM을 먼저 읽어서 Virtual DOM으로 만든 뒤 테스트 영역을 렌더링합니다.
2. TEXT patch 시연
   - 문장 하나를 수정합니다.
   - `Patch`를 누르면 patch 로그에 `TEXT`가 표시되고 실제 영역 텍스트만 바뀝니다.
3. PROPS patch 시연
   - `data-version="v2"` 값을 `v3`로 변경합니다.
   - `Patch`를 누르면 `PROPS` patch가 표시됩니다.
4. keyed REORDER 시연
   - `feature-list` 내부의 `<li data-key="dom">`, `<li data-key="diff">`, `<li data-key="patch">` 순서를 바꿉니다.
   - `Patch`를 누르면 `REORDER` patch가 찍히고, 같은 key를 유지한 채 순서만 재배치됩니다.
5. keyed 추가 / 삭제 시연
   - 새 `<li data-key="extra">...</li>` 를 추가합니다.
   - 기존 keyed 항목 하나를 삭제합니다.
   - `Patch`를 누르면 같은 부모 아래 keyed 구성 변경으로 `REORDER` patch가 표시됩니다.
6. 일반 CREATE / REMOVE 시연
   - 루트 섹션 맨 아래에 새 `<p>새 문단</p>` 를 추가합니다.
   - 방금 추가한 문단을 다시 삭제합니다.
   - `Patch`를 누르면 index 기반 영역에서는 `CREATE`, `REMOVE` patch를 확인할 수 있습니다.
7. Undo / Redo 시연
   - 직전 상태로 되돌아가고 다시 앞으로 이동하면서 state history가 동작함을 보여줍니다.

## 발표 때 강조하면 좋은 포인트

- 실제 DOM이 느린 이유
  - DOM 변경이 많아질수록 Reflow / Repaint 비용이 증가합니다.
- Virtual DOM이 필요한 이유
  - 메모리 상의 트리 비교 후 실제 DOM 변경을 최소화할 수 있습니다.
- React와 연결되는 개념
  - React도 상태 변경 후 Virtual DOM을 만들고 reconciliation(diff) 결과를 기반으로 실제 DOM 변경을 최소화합니다.
- 이번 구현의 한계
  - React Fiber 수준의 scheduler는 없습니다.
  - mixed keyed/unkeyed children 최적화는 없습니다.
  - 이벤트 시스템이나 component abstraction도 없습니다.

## 다음 개선 아이디어

- mixed children에서도 더 정교한 keyed diff 지원
- patch 로그를 history 단위로 보관
- MutationObserver로 실제 DOM 변경 실험
- 성능 비교용 대량 리스트 벤치마크 추가
