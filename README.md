<img width="1322" height="919" alt="image" src="https://github.com/user-attachments/assets/0fcaa8d9-1023-4299-a6ab-6630d805dd89" />

# 한국 주식 정보 대시보드 **(Korean Stock Dashboard)**[https://korean-stock-r0gd0hiqi-leesangcheols-projects.vercel.app/]

## 프로젝트 소개

한국 주식 시장의 실시간 정보를 제공하는 **주식 정보 대시보드**입니다.

### 목표
- 한국 주식 시장의 실시간 데이터를 직관적으로 시각화
- 종목별 상세 정보와 차트를 통한 투자 분석 지원
- 반응형 디자인으로 모바일/데스크톱 모두 지원

### 주요 기능

| **실시간 주가 조회** | **종목 상세 정보** | **차트 시각화** |
|:---:|:---:|:---:|
|:---:|:---:|:---:|
| 주식 종목 실시간 가격 조회 | 개별 종목의 상세 정보 제공 | 다양한 차트로 시세 변동 확인 |
| • 종목명 검색 기능<br>• 실시간 가격 업데이트<br>• 등락률 표시 | • 현재가, 시가, 고가, 저가<br>• 거래량 정보<br>• 전일 대비 등락률 | • Recharts 라이브러리 활용<br>• 일봉, 주봉, 월봉 차트<br>• 인터랙티브 차트 |

---

## 기술 스택

### Frontend
- **Next.js 15.5.6**: React 기반 풀스택 프레임워크
- **React 19.1.0**: 사용자 인터페이스 구축
- **TypeScript 5**: 타입 안정성 확보
- **Tailwind CSS 4**: 유틸리티 기반 스타일링
- **Lucide React 0.546.0**: 아이콘 라이브러리
- **Recharts 3.3.0**: 차트 시각화 라이브러리

### API & Data
- **Axios 1.12.2**: HTTP 클라이언트
- **한국투자증권 OpenAPI**: 한국 주식 실시간 데이터

### 개발 도구
- **ESLint 9**: 코드 품질 관리
- **Turbopack**: 고속 번들러

### 배포 및 호스팅
- **Vercel**: 프론트엔드 배포
- **GitHub**: 소스 코드 관리

---

## 설치 및 실행 방법

### 1. 저장소 클론
```bash
git clone https://github.com/cheul-95/korean-stock-app.git
cd korean-stock-app
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```env
# 한국투자증권 API (실전투자 또는 모의투자)
KIS_APP_KEY=your_app_key
KIS_APP_SECRET=your_app_secret
```

> 💡 **API 키 발급 방법**  
> 한국투자증권 API: [KIS Developers](https://apiportal.koreainvestment.com)에서 회원가입 후 발급

### 4. 개발 서버 실행
```bash
npm run dev
```
브라우저에서 [http://localhost:3000](http://localhost:3000)이 자동으로 열립니다.

### 5. 빌드 및 배포
```bash
# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

---

## 폴더 구조
```
korean-stock-app/
├── app/                        # Next.js App Router
│   ├── page.tsx                # 메인 페이지
│   ├── stocks/
│   │   └── [symbol]/           # 종목 상세 페이지
│   ├── api/                    # API 라우트
│   │   ├── gold/               # 금 시세 API
│   │   ├── stockcode/          # 종목 코드 관련 API
│   │   │   ├── [code]/         # 종목 코드별 조회
│   │   │   ├── search/         # 종목 검색
│   │   │   └── volumeRank/     # 거래량 순위
│   │   └── stock/
│   │       └── [symbol]/       # 종목 데이터 API
│   ├── globals.css             # 전역 스타일
│   └── layout.tsx              # 레이아웃
│
├── components/                 # 재사용 컴포넌트
│   ├── AskingPriceTable.tsx    # 호가 테이블
│   └── StockChart.tsx          # 차트 컴포넌트
│
├── lib/                        # 유틸리티
│   └── api/                  
│       └── kisApi.tsx          # 한국투자증권 API 호출 함수
│
├── types/                      # TypeScript 타입 정의
│   └── stock.ts                # 주식 관련 타입
│
└── public/                     # 정적 파일
```

---

## URL 구조

| 경로 | 설명 |
|------|------|
| `/` | 메인 대시보드 (인기 종목, 시장 지수) |
| `/stocks/[symbol]` | 종목 상세 페이지 (예: `/stocks/005930`) |

> 💡 동적 라우팅을 사용하여 각 종목별 상세 페이지를 자동 생성합니다.

---

## 주요 기능 상세

### 1. 실시간 주가 조회
```typescript
// 한국투자증권 API를 통한 실시간 시세 조회
const getStockPrice = async (symbol: string) => {
  const response = await axios.get(`/api/stocks/${symbol}`);
  return response.data;
};
```

### 2. 차트 시각화
- **Recharts** 라이브러리 사용
- 라인 차트, 캔들스틱 차트 지원
- 반응형 차트로 모바일 최적화

### 3. 종목 검색
- 종목명 또는 종목코드로 검색
- 자동완성 기능

---

## API 연동

### 한국투자증권 OpenAPI
```typescript
// 주요 API 엔드포인트
GET /api/stockcode/search       // 종목 검색
GET /api/stockcode/[code]       // 종목 정보 조회
GET /api/stockcode/volumeRank   // 거래량 순위
GET /api/stock/[symbol]         // 주식 시세 조회
GET /api/gold                   // 금 시세 조회
```

---

## 연락처

- **이메일**: tkdcjf3552@gmail.com
- **GitHub**: [https://github.com/cheul-95](https://github.com/cheul-95)
- **포트폴리오**: [https://lsch.co.kr/](https://lsch.co.kr/)

---

**© 2025 이상철. All rights reserved.**
