![전국 축제 지도 프로젝트 표지](docs/cover.svg)

# 전국 축제 지도 · Festival Map

**이번 주말, 어디로 갈까요?** 지역과 기간을 고르고 전국 축제를 지도에서 찾아보는 웹앱입니다.

`Next.js` · `TypeScript` · `Kakao Maps` · `TourAPI`

## 한눈에 보는 기능

| 찾기 | 살펴보기 | 기억하기 |
| --- | --- | --- |
| 지역·기간·상태 필터와 이름·장소 검색 | 지도 마커, 상세 카드, 기간과 주소 | 즐겨찾기와 공유 링크 |

축제 목록과 지도를 연결해 관심 있는 행사의 위치를 바로 확인할 수 있습니다. 진행 중·개최 예정·종료 상태를 구분하고, 종료된 행사의 표시 여부를 바꿀 수 있습니다. 즐겨찾기는 브라우저에 저장됩니다.

## 이렇게 사용해요

1. 지역과 날짜 범위를 선택합니다.
2. 축제 이름이나 장소를 검색하거나 지도에서 마커를 선택합니다.
3. 상세 정보와 길찾기를 확인하고, 관심 행사를 즐겨찾기에 넣습니다.

> 기존 배포 주소는 이번 점검에서 정상 응답을 확인하지 못했습니다. 아래 방법으로 로컬에서 실행할 수 있습니다.

## 로컬 실행

```bash
git clone https://github.com/cbjworld/festival-map.git
cd festival-map
npm install
```

`.env.local.example`을 `.env.local`로 복사한 뒤 아래 값을 설정합니다.

| 변수 | 용도 |
| --- | --- |
| `TOUR_API_KEY` | 서버의 관광정보 조회 키 |
| `NEXT_PUBLIC_KAKAO_MAP_APP_KEY` | 브라우저의 카카오 지도 JavaScript 키 |
| `NEXT_PUBLIC_KAKAO_JS_KEY` | 카카오톡 공유 기능의 JavaScript 키(선택) |

```bash
npm run dev
```

`http://localhost:3000`에서 열 수 있습니다. 카카오 개발자 콘솔의 허용 도메인에도 로컬 또는 배포 주소를 등록하세요. 관광정보 키는 서버 환경변수로 관리하세요.

## 배포와 구조

```bash
npm run build
npm start
```

Next.js를 지원하는 환경에 배포하고 동일한 환경변수를 설정합니다.

| 경로 | 역할 |
| --- | --- |
| `src/app/page.tsx` | 검색·필터·지도와 목록 |
| `src/app/api/festivals/route.ts` | 축제 데이터 API |
| `src/components/KakaoMap.tsx` | 지도와 마커 |
| `src/hooks/useFavorites.ts` | 브라우저 즐겨찾기 |
| `src/lib/tourapi.ts` | 관광정보 조회·변환 |

## 데이터 안내

행사 일정과 상세 정보는 데이터 제공처와 실제 행사 안내를 함께 확인하세요. 요약 문구는 보유 필드로 만드는 규칙 기반 요약이며, 외부 생성형 AI를 호출하지 않습니다.

## 함께 개선해요

유용했다면 **⭐ Star**로 응원해 주세요. [Issues](https://github.com/cbjworld/festival-map/issues)에 오류 재현 방법이나 개선 아이디어를 남겨주시면 도움이 됩니다. 예시 자료에서 개인정보와 비공개 데이터는 제거해 주세요.

**English:** Explore Korean festivals by region, date and status on a Kakao map. Built with Next.js and TypeScript, with browser-local favorites and server-side tourism data fetching.
