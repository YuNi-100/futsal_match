# ⚽ WGH Futsal Match

**We Go High (WGH)** 풋살팀의 경기 일정, 경기 결과, 선수 기록을 관리하기 위해 만든 웹 프로젝트입니다.

현재 버전은 **Node.js + Express + MySQL** 기반으로 구성되어 있으며, 프론트엔드는 HTML, CSS, JavaScript를 사용합니다.

> 현재 저장소는 Node.js 기반 버전입니다. 추후 백엔드를 Python **FastAPI** 기반으로 전환할 예정입니다.

---

## 📌 주요 기능

### 경기 기록 관리
- 경기 목록 조회
- 경기 결과 등록
- 기존 경기 기록 수정
- 경기 기록 삭제
- 상대팀, 날짜, 장소, 득점 등의 경기 정보 관리

### 경기 일정 관리
- 경기 일정 등록
- 경기 날짜 및 시작/종료 시간 입력
- 다음 경기 일정 조회
- 시작 시간과 종료 시간 입력 검증

### 선수 기록
- 선수 목록 조회
- 등번호 및 포지션 표시
- 선수별 출전 경기 수 집계
- 선수별 득점 기록 집계
- 선수별 도움 기록 집계

### WGH UI
- WGH 로고 및 Hero 영역
- `We Go High` 손글씨 이미지
- 경기 일정 및 경기 기록 UI
- 선수 정보 UI

---

## 🛠 기술 스택

| 구분 | 기술 |
| --- | --- |
| Frontend | HTML5, CSS3, JavaScript |
| Backend | Node.js, Express |
| Database | MySQL |
| DB Driver | mysql2 |
| Environment | dotenv |
| Version Control | Git, GitHub |
| Deployment | Vercel 배포 예정 |

---

## 📁 프로젝트 구조

```text
futsal_match/
├── public/
│   ├── images/
│   │   ├── hero-bg.jpg
│   │   ├── pink-ball.png
│   │   ├── we-go-high.png
│   │   └── wgh-logo.png
│   ├── app.js
│   ├── index.html
│   ├── style.css
│   └── style_backup.css
├── .env
├── .gitignore
├── package.json
├── package-lock.json
└── server.js
```

> `.env`와 `node_modules/`는 GitHub에 업로드하지 않습니다.

---

## 🗄 MySQL

프로젝트는 MySQL 데이터베이스와 연결되어 있습니다.

현재 코드에서 사용하는 주요 테이블은 다음과 같습니다.

- `futsal_match` : 경기 기록
- `futsal_schedule` : 경기 일정
- `futsal_player` : 선수 정보
- `match_player` : 경기별 선수 출전 및 공격 포인트 기록

데이터베이스의 테이블명과 컬럼명은 영문으로 관리하고, 웹 화면에서는 사용자에게 한글 UI로 표시합니다.

---

## 🔌 주요 API

| Method | Endpoint | 기능 |
| --- | --- | --- |
| GET | `/api/matches` | 경기 기록 조회 |
| POST | `/api/matches` | 경기 기록 등록 |
| PUT | `/api/matches/:id` | 경기 기록 수정 |
| DELETE | `/api/matches/:id` | 경기 기록 삭제 |
| POST | `/api/schedules` | 경기 일정 등록 |
| GET | `/api/schedules/next` | 다음 경기 일정 조회 |
| GET | `/api/players` | 선수 목록 및 누적 기록 조회 |

---

## ⚙️ 환경 변수

프로젝트 루트에 `.env` 파일을 생성하고 MySQL 연결 정보를 설정합니다.

```env
DB_HOST=localhost
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=your_database_name
DB_PORT=3306
```

실제 비밀번호가 포함된 `.env` 파일은 GitHub에 업로드하지 않습니다.

---

## ▶️ 로컬 실행 방법

### 1. 저장소 복제

```bash
git clone <repository-url>
cd futsal_match
```

### 2. 패키지 설치

```bash
npm install
```

### 3. `.env` 설정

위의 환경 변수 예시를 참고하여 MySQL 연결 정보를 입력합니다.

### 4. 서버 실행

현재 프로젝트는 `server.js`를 직접 실행합니다.

```bash
node server.js
```

서버가 정상적으로 실행되면 다음 주소에서 확인할 수 있습니다.

```text
http://localhost:3000
```

---

## 🔒 보안

`.gitignore`에는 다음 항목을 포함하여 중요한 정보와 불필요한 패키지 파일이 GitHub에 올라가지 않도록 합니다.

```gitignore
.env
node_modules/
```

DB 계정, 비밀번호 등의 민감한 값은 코드에 직접 작성하지 않고 환경 변수로 관리합니다.

---

## 🚀 배포

GitHub 저장소와 Vercel을 연결하여 배포할 예정입니다.

현재 로컬 MySQL을 사용하는 개발 버전이므로, 실제 배포 환경에서 데이터베이스 기능을 사용하려면 외부에서 접근 가능한 MySQL 데이터베이스와 배포 환경 변수를 별도로 설정해야 합니다.

---

## 🔄 향후 계획

현재 Node.js/Express 백엔드를 기준으로 프로젝트를 완성한 뒤 다음 단계에서 **FastAPI 기반 백엔드로 전환**할 예정입니다.

```text
현재
HTML / CSS / JavaScript
        ↓
Node.js / Express
        ↓
MySQL

향후
HTML / CSS / JavaScript
        ↓
Python / FastAPI
        ↓
MySQL
```

프론트엔드 디자인과 MySQL 데이터 구조는 가능한 한 유지하면서 백엔드 API를 FastAPI로 변경하는 것을 목표로 합니다.

---

## 👤 Project

**WGH (We Go High) Futsal Match**

풋살팀의 경기 일정과 경기 기록, 선수 데이터를 한곳에서 관리하기 위한 웹 프로젝트입니다.
