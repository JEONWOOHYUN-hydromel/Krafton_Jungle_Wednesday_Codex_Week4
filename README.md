# Virtual DOM Playground

Vanilla JavaScript로 만든 과제용 Virtual DOM / Diff / Patch 프로젝트 골격입니다.  
목표는 브라우저 DOM을 Virtual DOM으로 변환하고, 이전 상태와 새 상태를 비교해서 변경된 부분만 실제 DOM에 반영하는 흐름을 명확하게 분리해 두는 것입니다.

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

## 핵심 역할

- `src/vdom/domToVdom.js`
  - 실제 DOM 또는 HTML 문자열을 Virtual DOM 트리로 변환합니다.
- `src/vdom/renderVdom.js`
  - Virtual DOM을 실제 DOM 노드로 렌더링합니다.
- `src/diff/diff.js`
  - 이전 VDOM과 새 VDOM을 비교해서 patch 목록을 만듭니다.
- `src/patch/patch.js`
  - patch 목록을 실제 DOM에 적용합니다.
- `src/app.js`
  - 초기화, 버튼 이벤트, history, UI 상태 업데이트를 담당합니다.
- `src/utils/helpers.js`
  - 공통 유틸 함수와 VDOM 직렬화 함수를 제공합니다.

## 현재 구현된 흐름

1. 페이지 로드 시 실제 영역의 샘플 DOM을 읽어 Virtual DOM으로 변환합니다.
2. 동일한 VDOM을 테스트 영역 미리보기에 렌더링합니다.
3. 테스트 영역의 HTML Editor에서 코드를 수정합니다.
4. `Patch` 버튼을 누르면:
   - 현재 HTML을 새 VDOM으로 변환합니다.
   - 이전 VDOM과 비교해서 patch 목록을 만듭니다.
   - patch만 실제 영역에 적용합니다.
   - 새 상태를 history에 저장합니다.
5. `Undo`, `Redo` 버튼으로 이전 상태 / 다음 상태를 다시 불러옵니다.

## Diff 알고리즘의 기본 5가지 케이스

- `CREATE`: 새 노드가 추가됨
- `REMOVE`: 기존 노드가 삭제됨
- `REPLACE`: 태그 타입 또는 노드 타입이 바뀜
- `TEXT`: 텍스트 내용만 바뀜
- `PROPS`: 속성(attribute)만 바뀜

현재 diff는 `index 기반 비교`를 사용합니다.  
향후에는 `key 기반 비교`, `부분 렌더링 최적화`, `컴포넌트 추상화`로 확장할 수 있습니다.

## 실행 방법

### 가장 간단한 방법

`index.html` 파일을 브라우저에서 직접 열면 됩니다.

### 로컬 서버로 열기

원하면 정적 서버로도 실행할 수 있습니다.

```bash
# 예시
python -m http.server 5500
```

이후 브라우저에서 `http://localhost:5500` 으로 접속합니다.

## 과제 발표용 설명 포인트

- 실제 DOM이 느린 이유
  - DOM 변경이 많아질수록 Reflow / Repaint 비용이 커집니다.
- Virtual DOM이 필요한 이유
  - 변경 전/후를 메모리 상의 트리로 비교한 뒤 최소 변경만 실제 DOM에 반영할 수 있습니다.
- React와 연결되는 개념
  - React도 UI 상태를 Virtual DOM으로 표현하고, Diff 결과를 기반으로 실제 DOM 변경을 최소화합니다.

## 다음 개선 아이디어

- key 기반 리스트 diff
- patch 로그를 화면에 시각화
- MutationObserver를 이용한 실제 DOM 변경 감지 실험
- edge case 테스트용 샘플 세트 추가

