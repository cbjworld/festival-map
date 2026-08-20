# 전국 축제 지도

한국관광공사 TourAPI 4.0(`searchFestival1`) 데이터를 카카오맵 위에 시각화하는 Next.js 웹 서비스입니다.

## 주요 기능

- 전체 화면 카카오맵에 축제를 상태별(진행 중 / 개최 예정 / 종료) 커스텀 마커로 표시
  - 🟢 진행 중: 초록색 마커 + 아우라 펄스 애니메이션
  - 🟡 개최 예정(14일 이내 시작): 노란색 마커
  - ⚪ 종료/기타: 회색 마커 (토글로 표시 여부 선택)
- 지역별(전국/서울/경기/강원/충청/전라/경상/제주) · 상태별(전체/진행 중/이번 주 시작) 필터
- 축제 이름 · 장소 실시간 검색
- 마커 클릭 시 상세 정보 카드 (모바일: 하단 시트, 데스크톱: 좌측 카드)
  - 대표 이미지, 기간, D-Day, 주소, AI 1줄 요약
  - 카카오맵 길찾기 연결 / 카카오톡 공유하기
- Next.js `fetch` 캐싱(`revalidate: 3600`)으로 TourAPI 호출 트래픽 절감

## 시작하기

### 1. 환경 변수 설정

`.env.local.example`을 복사해 `.env.local`을 만들고 값을 채워주세요.

```bash
cp .env.local.example .env.local
```

- `TOUR_API_KEY`: [공공데이터포털](https://www.data.go.kr)에서 "한국관광공사_국문 관광정보 서비스" 활용신청 후 발급받은 **Decoding** 서비스 키
- `NEXT_PUBLIC_KAKAO_MAP_APP_KEY`: [카카오 개발자 콘솔](https://developers.kakao.com)에서 발급받은 JavaScript 키
  - 콘솔 > 내 애플리케이션 > 앱 설정 > 플랫폼에 배포 도메인(예: `https://your-app.vercel.app`, 로컬 개발용 `http://localhost:3000`)을 등록해야 지도가 정상적으로 로드됩니다.
- `NEXT_PUBLIC_KAKAO_JS_KEY`: 카카오톡 공유하기(Kakao SDK)용 JS 키. 보통 위 지도 키와 동일한 앱 키를 사용합니다.

### 2. 패키지 설치 및 실행

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속

### 3. 배포 (Vercel)

1. GitHub 리포지토리에 push
2. Vercel에서 Import Project
3. 프로젝트 설정 > Environment Variables에 `.env.local`과 동일한 키/값 등록
4. 카카오 개발자 콘솔의 플랫폼 설정에 Vercel 배포 도메인 추가

## 프로젝트 구조

```
src/
  types/festival.ts            TourAPI 응답 및 축제 도메인 타입
  types/kakao-maps.d.ts        카카오맵 JS SDK 최소 타입 선언
  lib/tourapi.ts                TourAPI 호출 및 Festival 변환/상태 계산 로직
  lib/utils.ts                  Tailwind 클래스 병합 유틸(cn)
  app/api/festivals/route.ts    TourAPI를 감싸는 API Route (1시간 캐시)
  components/KakaoMap.tsx       커스텀 오버레이 마커 카카오맵 컴포넌트
  components/FestivalDetailCard.tsx  상세 정보 카드/시트
  components/ui/button.tsx      Shadcn 컨벤션 Button 컴포넌트
  app/page.tsx                  지도 + 검색 + 필터 + 상세카드 통합 메인 페이지
```

## 참고 사항

- TourAPI 응답에는 문의처(`sponsor1`), 전화번호(`tel`) 등이 비어있는 경우가 많아 UI에서는 값이 있을 때만 표시하도록 처리되어 있습니다.
- "AI 1줄 요약"은 API 비용 없이 동작하도록 보유 필드 기반 휴리스틱으로 생성됩니다. 실제 LLM 요약으로 교체하려면 `src/lib/tourapi.ts`의 `buildAiSummary` 함수를 API Route(Claude/OpenAI 등)를 호출하도록 교체하면 됩니다.
- 지역 필터는 TourAPI `areacode`를 광역 그룹(충청/전라/경상 등)으로 매핑한 것으로, 세부 시/도가 필요하면 `AREA_CODE_TO_REGION`을 확장하세요.
