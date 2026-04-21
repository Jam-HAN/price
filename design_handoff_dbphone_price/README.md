# Handoff: 대박통신 단가표 시스템 (DBphone Price Studio)

## Overview

대박통신(통신 대리점)의 **단가표 생성·관리 시스템**. 담당자가 단말기를 선택하고 통신사별 리베이트 이미지를 업로드하면, OCR 파싱 결과를 확인·편집한 뒤 **내부용 넷가표**(원가/마진 포함)와 **고객용 단가표**(할부금/월 납부액) 두 종류를 자동 생성·공유할 수 있는 SaaS 형태의 내부 툴입니다.

주요 사용자:
- 대리점 직원 (단가표 생성, 고객 상담)
- 점주/관리자 (정책 관리, 매출 리뷰)
- 고객 상담 대응

## About the Design Files

이 번들에 포함된 파일들은 **HTML로 제작된 디자인 레퍼런스**입니다 — 의도한 모양과 동작을 보여주는 프로토타입이지, 그대로 프로덕션에 넣는 코드가 아닙니다. 개발 작업은 **이 HTML 디자인을 타겟 코드베이스의 환경(React/Vue/Next.js 등 기존 프레임워크와 컴포넌트 라이브러리)에서 재구현**하는 것을 의미합니다. 아직 코드베이스가 없다면 프로젝트 성격에 맞는 프레임워크를 선택해 구현하면 됩니다.

HTML 파일의 의존성(인라인 SVG, CDN Pretendard/Babel 등)은 **구현 시 제거**하고, 실제 코드베이스의 디자인 토큰·컴포넌트 시스템·빌드 환경을 사용하세요.

## Fidelity

**High-fidelity (hifi)**. 색상·타이포그래피·간격·인터랙션이 최종 형태에 가깝게 정의되어 있습니다. 픽셀 퍼펙트에 가깝게 재현하되, 아이콘/이미지 플레이스홀더·단말기 일러스트 SVG는 실제 제품 자산으로 교체해야 합니다.

주의: 통신사 이름은 저작권 회피를 위해 **A텔레콤 / B모바일 / C유플** 등 제네릭으로 표기되어 있습니다. 실서비스 구현 시 실제 통신사명(SKT/KT/LGU+)으로 교체 필요.

---

## 전체 플로우

```
[Dashboard] ──> [STEP 1 단말기 선택] ──> [STEP 2 리베이트 업로드]
                                                    │
                                                    ▼
                 [STEP 4 출력 & 공유] <── [STEP 3 매트릭스 편집]
                        │
                        └──> [History] (저장된 단가표)
```

상단 `<Steps>` 인디케이터가 STEP 1–4의 진행 상태를 표시합니다.

---

## Screens / Views

### 1) Dashboard (`/dashboard`)

**목적**: 오늘/이번 주 단가표 발행 현황 요약, 최근 단가표·활동 로그 접근

**레이아웃**:
- 좌측 고정 사이드바 232px + 메인 콘텐츠 (max-width 1208px)
- 메인: 상단 헤더 / 4칸 stat 카드 그리드 / 2:1 분할(주간 추이 차트 + 통신사별 비중) / 1.3:1 분할(최근 단가표 테이블 + 활동 로그)

**컴포넌트**:
- **Stat Card** (4개: 오늘 발행 / 주간 체결 / 활성 모델 / 미처리 리베이트)
  - 흰 배경, `border: 1px solid #e7ebf3`, `border-radius: 14px`, padding 16px
  - label 12px/600 `#7a8197`, value 28px/800, delta 12px (`#10b981` up / `#ff4d4f` down)
  - 우상단 pill: 10px/700, 배경색은 카테고리에 따라 (`#eaf0ff`/`#f4ffc7`/`#ffeaf4`/`#fff7d0`)
- **주간 추이 차트**: 12개 막대, 오늘은 solid `#2152ff`, 과거는 `linear-gradient(180deg, #b9c9ff, #eaf0ff)` + `1px solid #d7e1ff`, height = 값 × 10px
- **통신사별 체결 비중**: horizontal bar (높이 8px, 배경 `#f1f4fa`, fill은 통신사 색). 각 통신사: A=`#d71f30`, B=`#a36a00`, C=`#0a59c7`
- **최근 단가표 테이블**: 6컬럼 (모델 / 통신사 / 담당 / 조회 / 체결 / 상태)
- **활동 로그**: 아이콘 원형(32px, bg `#f1f4fa`) + 텍스트. 타입별 아이콘색: publish=`#10b981`, upload=`#2152ff`, share=`#ff5fae`, archive=`#7a8197`, edit=`#ffd84a`

### 2) Models / 단말기 선택 (`/models`, STEP 1)

**목적**: 단가표를 만들 단말기를 검색·선택하고 용량/색상을 지정

**레이아웃**:
- 검색/필터 바 (full-width card) + `선택 없음일 때` 3컬럼 모델 카드 그리드 / `선택 있을 때` 1.6:1 분할 (모델 그리드 + sticky 상세 패널)

**컴포넌트**:
- **Search input**: 360px 최대폭, 좌측 아이콘, focus 시 `border-color: #2152ff`, `box-shadow: 0 0 0 3px rgba(33,82,255,0.12)`
- **Segmented filter** (전체/Samsung/Google/Sony): `background: #f1f4fa`, inner padding 3px, active는 흰 배경 + shadow
- **Model Card** (`.model-card`):
  - 흰 배경, `border: 1px solid #e7ebf3`, `border-radius: 14px`, padding 14px
  - hover: border `#2152ff`, `translateY(-2px)`, `box-shadow: 0 8px 24px -12px rgba(33,82,255,0.3)`
  - 선택됨: border `#2152ff`, bg `#eaf0ff`
  - 상단: 110px 높이 일러스트 영역 (모델 accent 컬러의 22%/08% 그라데이션 배경 + 인라인 phone SVG). 실서비스에서는 **실제 제품샷**으로 교체
  - 태그 배지 우상단: NEW(lime)/HOT(pink)/PREMIUM(ink)/VALUE(yellow)
  - 하단: 용량 pills (10px, `#f1f4fa`) / 출고가 라인
- **상세 패널** (선택 시 우측, `position: sticky; top: 22px`):
  - 큰 단말기 일러스트 (그라데이션 배경) + 모델명 + 코드
  - 용량 선택 버튼 (active: 2px `#2152ff` border + `#eaf0ff` bg)
  - 색상 칩들 + 출고가
- **등록 모달** (`<Modal>`): 560px 폭, 모델명/코드/제조사/출고가/용량/색상 폼

### 3) Upload / 리베이트 업로드 (`/upload`, STEP 2)

**목적**: 통신사별 리베이트 이미지(PNG/JPG/PDF)를 업로드하고 OCR 파싱 트리거

**레이아웃**: 1.15:1 분할 — 좌측 업로드 영역, 우측 미리보기 (sticky)

**컴포넌트**:
- **Dropzone** (`.dz`): `border: 2px dashed #c7d0e3`, `background: #f7f9ff`, padding 36/24px, radius 16px. hover/drag 시 border `#2152ff` + bg `#eaf0ff`
- 상단 알림 (`.alert.info`): `#eaf0ff` bg + `#d7e1ff` border, sparkle 아이콘 + OCR 지원 안내
- **업로드 진행 리스트** (통신사별 3개):
  - 40×40 통신사 뱃지 (A: `#ffeef0`/`#d71f30`, B: `#fff3da`/`#a36a00`, C: `#e8f4ff`/`#0a59c7`)
  - 상태별 UI: 대기중(회색 텍스트) / 파싱중(spinner + 진행바 4px bg `#f1f4fa`, fill `#2152ff`) / 완료(체크 + 파싱 요약)
  - 샘플 업로드 버튼: 순차 진행 (180ms tick, 8~20%씩 증가)
- **미리보기 패널**:
  - 빈 상태: 72×72 `#f1f4fa` placeholder + 안내 문구
  - 파싱 중: SVG 이미지 위에 `scan-line` 애니메이션 (`height: 2px`, `background: linear-gradient(90deg, transparent, #2152ff, transparent)`, `box-shadow: 0 0 12px #2152ff`, top 0→100% 1.4s ease-in-out infinite)
  - AI 추출 결과 박스: `#f7f9ff` bg + `1px dashed #c7d0e3`, radius 10px, scan 아이콘 + 추출 항목 리스트

### 4) Editor / 매트릭스 편집 (`/editor`, STEP 3)

**목적**: OCR로 파싱된 리베이트 매트릭스를 표 형태로 편집, 넷가/마진 실시간 계산

**레이아웃**: 4개 요약 stat + 편집 테이블 카드 (가로 스크롤, max-height 560px)

**주요 계산식**:
```
지원합계 = 공시지원금 + 추가지원금 + 리베이트
넷가 = 출고가 - 지원합계
마진 = 넷가 - 사입가(costBasis, 기본 = 출고가 - 80,000원)
마진율 = margin / net × 100
```

**컴포넌트**:
- **Tabs** (통신사 전환) + **Switch** (마진/넷가 컬럼 표시 토글)
- **편집 테이블** (`.edit-t`):
  - 컬럼: 요금제 / 월 요금 / 공시 / 추가 / 리베이트(신규) / 리베이트(번이, 노란 배경 `#fff7d0`) / 리베이트(기변) / 넷가(파란 `#eaf0ff`) / 마진(라임 `#f4ffc7`)
  - 셀 입력 (`.cell`): 투명 배경, focus 시 `border: 1px solid #2152ff` + white bg + `box-shadow: 0 0 0 2px rgba(33,82,255,0.1)`
  - JetBrains Mono, 우측 정렬, 천단위 콤마
  - 헤더 sticky top 0, `#f5f7fb` bg
- **Footer**: 색상 레전드 + 보조 버튼 ("다른 통신사로 복사", "AI로 보정")

### 5) Output / 출력 & 공유 (`/output`, STEP 4)

**목적**: 같은 데이터를 **넷가표(내부용 다크)** 또는 **고객용 단가표(블루)** 두 템플릿으로 렌더링

**컨트롤 바**:
- 모드 토글 (넷가 / 고객용), 통신사 세그먼트, 계약 구분(신규/번이/기변), 고객용일 때 할부 개월수(24/30/36/48)

#### 5a) NetSheet (넷가표, 내부용)
- 헤더: `linear-gradient(135deg, #0b1020, #1c2452)`, 흰 텍스트, "대외비" 칩(lime dot), 시리얼 `NET-2026-M1-256` 포맷
- 요약 4칸 (출고가 / 사입가 / 평균 넷가 / 평균 마진) — 각 색상 배경 (`#f5f7fb` / `#ffeaf4` / `#eaf0ff` / `#f4ffc7`)
- 테이블 (`.ps-table`):
  - 그룹 행: `background: #0b1020`, `color: #d4ff3f`, 대문자
  - 컬럼: 요금제 / 월요금 / 공시 / 추가 / 리베이트 / 지원합계 / 넷가 / 마진 / 마진율
  - 마진: 양수 `#10b981`, 음수 `#ff4d4f`
- Footer: 조건 + 기밀 고지문

#### 5b) CustSheet (고객용 단가표)
- 헤더: `linear-gradient(135deg, #2152ff, #7a9bff)`, 흰 텍스트, 브랜드 로고(라임→민트 그라데이션 원, "대")
- 헤더 아래 **recommendation card** (흰 카드, -16px 오버랩, shadow `0 4px 16px -8px rgba(33,82,255,0.3)`): 단말기 일러스트 + "최저 월 ○○원" 강조
- 테이블 (`.ps-table.cust`):
  - 그룹 행: `background: #2152ff`, 흰 글씨
  - 컬럼: 요금제 / 월요금 / 공시지원금 / 추가지원금 / 할부원금 / 월 할부금 / 총 월 납부액
  - 할부 계산: `principal = 출고가 - (공시+추가)`, `monthly = round(principal / months / 10) × 10`
  - `BEST` 뱃지(lime)로 추천 요금제 강조
- 하단 3칸 (상담 문의 / 가입 혜택 / 배송) — 각 `#eaf0ff`/`#f4ffc7`/`#ffeaf4` 배경

### 6) History / 단가표 히스토리 (`/history`)

**목적**: 발행된/초안/보관된 단가표 목록, 검색·필터·복제·공유

**레이아웃**: 4개 상태 stat + 검색/필터 + 테이블

**컴포넌트**:
- **상태 Chip**: 발행중(`.chip.mint` — `#ddfbf1`/`#067c5c`), 초안(`.chip.yellow` — `#fff7d0`/`#7a5a00`), 보관(기본 `.chip` — `#f1f4fa`/`#3b4358`)
- 테이블 행: 썸네일(36×46, striped placeholder) + 모델·일시 / 통신사 / 담당자(24px 원형 avatar) / 조회 / 체결 / 상태 / 액션(미리보기·복제·공유)

---

## Navigation (Sidebar)

- 232px 고정 폭, `background: #0b1020`, 흰 텍스트
- 브랜드 로고: 32px radius 9px, `linear-gradient(135deg, #2152ff, #7a9bff 60%, #d4ff3f)`
- nav-item: 9/10px padding, radius 9px, 14px/500, hover `#141a33`, active `#2152ff`/흰색
- 섹션 헤더: 11px/600 `#6b7391`, uppercase, letter-spacing 0.1em
- STEP 뱃지: lime `#d4ff3f`, 10px/700, 2/6px pad, radius 99px
- Disabled nav-item: opacity 0.4, `cursor: not-allowed` — 선행 스텝이 완료되어야 활성화
- 하단: 실시간 정책 동기화 카드(`#141a33` bg) + 유저 칩

---

## Interactions & Behavior

- **단계 진행**: `selected` 있어야 STEP 2, `rebateData.length > 0` 있어야 STEP 3/4 이동 가능
- **업로드 시뮬레이션**: setTimeout 체인으로 0→100% 진행, 완료 시 `rebateImages[carrier]` 객체 저장. 실제 구현에서는 presigned URL 업로드 + OCR 서버 polling으로 교체
- **실시간 계산**: Editor의 셀 변경이 즉시 Output까지 반영 (React state 공유)
- **Route 영속성**: `localStorage.setItem('dbp:route', route)` — 새로고침해도 현재 화면 유지
- **Toast**: 중앙 하단 `#0b1020` bg, 라임 체크 아이콘, 2400ms 후 자동 사라짐
- **애니메이션**:
  - `@keyframes scan` 1.4s ease-in-out infinite (업로드 파싱 시)
  - `@keyframes spin` 0.8s linear infinite (spinner)
  - `@keyframes pulse` 1.2s ease-in-out infinite
  - 카드 hover: `transition: all .15s ease`
- **Print**: `@media print` — sidebar, page header, toolbar 숨김 → 시트만 출력

---

## State Management

최소 상태(현재 React useState로 구현, Redux/Zustand/서버 상태 분리 권장):

```
route                  string        현재 화면 id
step                   1|2|3|4       STEP 인디케이터
selected               Model | null  선택된 단말기
storage                string        예: "256GB"
rebateImages           { [carrierId]: { model, carrier, ts, variant } }
rebateData             RebateRow[]   편집 가능한 매트릭스
tweaks                 { primaryBlue, accentLime }
```

`RebateRow`: `{ carrier, contract, tier, planName, planPrice, gongsi, extra, rebate }`

**서버 모델 제안**:
- `GET/POST /api/models` — 단말기 CRUD
- `POST /api/rebates/upload` (multipart) → presigned URL + OCR job id
- `GET /api/rebates/jobs/:id` — OCR 파싱 진행 상태·결과
- `POST /api/pricesheets` — 단가표 저장, `{ modelId, storage, carrier, rows, costBasis, status }`
- `GET /api/pricesheets?status=` — 히스토리
- `POST /api/pricesheets/:id/share` → 공유 토큰 발급

---

## Design Tokens

### Colors

```
--bg:         #f5f7fb     페이지 배경
--panel:      #ffffff     카드 배경
--ink:        #0b1020     본문 텍스트
--ink-2:      #3b4358     보조 텍스트
--ink-3:      #7a8197     캡션/placeholder
--line:       #e7ebf3     경계선
--line-2:     #f1f4fa     내부 보조선

--blue:       #2152ff     Primary (CTA, 링크, 고객용 단가표)
--blue-2:     #133ed8     Primary hover
--blue-soft:  #eaf0ff     Primary 옅은 배경

--lime:       #d4ff3f     Accent (뱃지, 대박통신 브랜드)
--pink:       #ff5fae     Accent (사입가, 공유 등)
--yellow:     #ffd84a     Accent (경고, 편집)
--mint:       #3fe0b0     Accent (성공)

--red:        #ff4d4f     에러/음수
--ok:         #10b981     성공/양수

Carrier A (레드):   bg #ffeef0, fg #d71f30
Carrier B (앰버):   bg #fff3da, fg #a36a00
Carrier C (블루):   bg #e8f4ff, fg #0a59c7
```

### Typography
- **본문**: Pretendard Variable (현재 CDN; 실서비스는 self-host 또는 `Pretendard` npm 패키지)
- **숫자/모노**: JetBrains Mono (`font-variant-numeric: tabular-nums`)
- **스케일**: h1 26px/800/-0.02em · card h3 15px/700 · 본문 13–14px/500 · caption 11–12px · overline 10–11px/600/0.06em uppercase
- **줄바꿈**: 한국어 장문에는 `text-wrap: pretty` 권장

### Spacing & Radius
- Card padding: 16–20px (head) / 18–26px (body)
- Grid gap: 14–16px
- Border-radius: chip 99px · input/seg 8–10px · card 14–16px · sheet 18px · sidebar logo 9px
- Shadows:
  - card hover: `0 8px 24px -12px rgba(33,82,255,0.3)`
  - sheet: `0 10px 40px -20px rgba(11,16,32,0.2)`
  - toast: `0 10px 30px rgba(0,0,0,0.2)`
  - focus ring: `0 0 0 3px rgba(33,82,255,0.12)`

### Motion
- 기본 transition: `all .15s ease`
- 키프레임: `scan` 1.4s · `spin` 0.8s · `pulse` 1.2s

---

## Assets

현재 디자인에서 사용된 자산은 모두 **인라인 SVG 플레이스홀더**입니다. 실구현 시 교체 필요:

- **단말기 일러스트** (`.model-card .img`, `상세 패널`, 출력 시트): 실제 제품 사진으로 교체
- **리베이트 샘플 이미지** (`src/rebate_image.jsx`): OCR 목업 전용. 실제로는 사용자 업로드 파일
- **아이콘** (`src/icons.jsx`): 자체 stroke 아이콘 세트. 코드베이스에 이미 있는 아이콘 라이브러리(Lucide / Heroicons 등)로 교체 권장
- **브랜드 로고**: 현재 "대" 글자 + 그라데이션. 실제 대박통신 로고로 교체

---

## Files

디자인 프로토타입 파일은 `design/` 폴더에 포함되어 있습니다:

- `design/app.html` — 엔트리 (스타일·CDN·스크립트 로드 순서)
- `design/src/data.jsx` — mock 데이터 (CARRIERS, MODELS, PLANS, HISTORY, `defaultRebateFor()`, `KRW()` formatter)
- `design/src/icons.jsx` — 24px stroke 아이콘 세트
- `design/src/shared.jsx` — `Chip`, `CarrierPill`, `PageHeader`, `Modal`, `Switch`, `useToast`
- `design/src/rebate_image.jsx` — SVG로 그린 리베이트 종이 목업
- `design/src/dashboard.jsx` — Dashboard 화면
- `design/src/models.jsx` — Models 화면 + `<Steps>` 컴포넌트
- `design/src/upload.jsx` — Upload 화면 (파싱 시뮬레이션 포함)
- `design/src/editor.jsx` — Editor 화면 (매트릭스 편집)
- `design/src/output.jsx` — Output 화면 (`NetSheet` + `CustSheet`)
- `design/src/history.jsx` — History 화면
- `design/src/app.jsx` — 루트 라우팅·사이드바·Tweaks 패널

---

## 구현 시 우선순위 제안

1. **디자인 시스템** 토큰 정립 → 색상/타이포/스페이싱/라운드/섀도우
2. **공통 컴포넌트**: Card, Chip, CarrierPill, SegmentedControl, DropZone, Toast, Modal, Switch, Steps
3. **데이터 레이어**: Models, Plans, RebateRow 타입 + API 클라이언트
4. **화면**: Dashboard → Models → Upload(+ OCR 연동) → Editor → Output(두 템플릿) → History
5. **PDF/이미지 출력**: 고객용 단가표의 `@media print` + `html-to-image`/Puppeteer로 PNG 생성
6. **권한**: 담당자(편집) / 점주(발행/삭제) / 열람 전용(고객 링크)

---

## Out of Scope (이번 디자인에서는 다루지 않음)

- 실제 OCR 연동 (업로드·파싱은 시뮬레이션)
- 인증/권한
- 결제·개통 플로우
- 모바일 반응형 (현재 1440px 고정폭 데스크탑 기준)
- 다크 모드 (출력 시트의 넷가표만 다크)
- i18n
