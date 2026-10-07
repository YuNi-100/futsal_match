// =========================================================
// WGH FUTSAL APP
// 경기 기록 팝업
// =========================================================


// ---------------------------------------------------------
// HTML 요소 가져오기
// ---------------------------------------------------------

const addMatchButton = document.getElementById("addMatchButton");

// 전체보기 버튼
const viewAllButton = document.getElementById("viewAllButton");

// 전체 경기 표시 여부
let showAllMatches = false;

// DB에서 불러온 경기 기록 보관
let currentMatches = [];

// 현재 수정 중인 경기 번호
// null이면 새 경기 등록 상태
let editingMatchId = null;


const matchModal = document.getElementById("matchModal");

const modalCloseButton = document.getElementById("modalCloseButton");

const cancelButton = document.getElementById("cancelButton");

const modalOverlay = document.getElementById("modalOverlay");

const matchForm = document.getElementById("matchForm");

const matchDate = document.getElementById("matchDate");

// =========================================================
// 다음 경기 일정 모달 요소
// =========================================================

const scheduleAddButton =
    document.getElementById("scheduleAddButton");

const scheduleModal =
    document.getElementById("scheduleModal");

const scheduleModalOverlay =
    document.getElementById("scheduleModalOverlay");

const scheduleModalCloseButton =
    document.getElementById("scheduleModalCloseButton");

const scheduleCancelButton =
    document.getElementById("scheduleCancelButton");

const scheduleForm =
    document.getElementById("scheduleForm");

// ---------------------------------------------------------
// 경기 등록 팝업 열기
// ---------------------------------------------------------

function openMatchModal() {

    matchModal.classList.add("active");

    document.body.classList.add("modal-open");


    // 오늘 날짜를 기본값으로 설정
    const today = new Date();

    const year = today.getFullYear();

    const month = String(
        today.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        today.getDate()
    ).padStart(2, "0");


    matchDate.value =
        `${year}-${month}-${day}`;
}


// ---------------------------------------------------------
// 경기 등록 팝업 닫기
// ---------------------------------------------------------

function closeMatchModal() {

    matchModal.classList.remove("active");

    document.body.classList.remove("modal-open");
}

// =========================================================
// 경기 날짜 입력창 전체 클릭 → 달력 열기
// =========================================================

const scheduleDateInput =
    document.getElementById("scheduleDate");

scheduleDateInput.addEventListener("click", function () {

    // 브라우저가 showPicker를 지원하는 경우
    if (typeof scheduleDateInput.showPicker === "function") {
        scheduleDateInput.showPicker();
    }

});

// =========================================================
// 선택한 경기 날짜 → "10월 21일 (수)" 표시
// =========================================================

const scheduleDateDisplay =
    document.getElementById("scheduleDateDisplay");


scheduleDateInput.addEventListener("change", function () {

    const selectedDate = scheduleDateInput.value;


    // 날짜가 선택되지 않은 경우
    if (!selectedDate) {

        scheduleDateDisplay.textContent = "";

        return;
    }


    // YYYY-MM-DD 분리
    const [year, month, day] =
        selectedDate.split("-").map(Number);


    // 요일 계산
    const date =
        new Date(year, month - 1, day);

    const weekdays =
        ["일", "월", "화", "수", "목", "금", "토"];

    const weekday =
        weekdays[date.getDay()];


    // 화면 표시
    scheduleDateDisplay.textContent =
        `${month}월 ${day}일 (${weekday})`;

});
// =========================================================
// 경기 시간 자동 변환
// 2000 → 20:00
// 2130 → 21:30
// =========================================================

const scheduleStartTime =
    document.getElementById("scheduleStartTime");

const scheduleEndTime =
    document.getElementById("scheduleEndTime");


function setupTimeInput(input) {

    input.addEventListener("blur", function () {

        // 숫자만 가져오기
        let value = input.value.replace(/\D/g, "");

        // 4자리 입력했을 때만 변환
        if (value.length === 4) {

            const hour = value.slice(0, 2);
            const minute = value.slice(2, 4);

            input.value = `${hour}:${minute}`;

        }

    });

}


setupTimeInput(scheduleStartTime);
setupTimeInput(scheduleEndTime);

// =========================================================
// 경기 시간 유효성 검사
// =========================================================

function isValidTime(time) {

    // 00:00 ~ 23:59 형식만 허용
    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

    return timePattern.test(time);
}


function validateScheduleTime() {

    const startTime = scheduleStartTime.value;
    const endTime = scheduleEndTime.value;


    // 시작 시간 검사
    if (!isValidTime(startTime)) {

        alert("시작 시간을 올바르게 입력해주세요.\n예: 20:00");

        scheduleStartTime.focus();

        return false;
    }


    // 종료 시간 검사
    if (!isValidTime(endTime)) {

        alert("종료 시간을 올바르게 입력해주세요.\n예: 21:30");

        scheduleEndTime.focus();

        return false;
    }


    // 종료 시간이 시작 시간보다 빠르거나 같은 경우
    if (endTime <= startTime) {

        alert("종료 시간은 시작 시간보다 늦어야 합니다.");

        scheduleEndTime.focus();

        return false;
    }


    return true;
}

// =========================================================
// 다음 경기 일정 모달 열기 / 닫기
// =========================================================

// 일정 등록 모달 열기
function openScheduleModal() {

    scheduleModal.classList.add("active");
    document.body.classList.add("modal-open");

}


// 일정 등록 모달 닫기
function closeScheduleModal() {

    scheduleModal.classList.remove("active");
    document.body.classList.remove("modal-open");

}


// 일정 등록 버튼
scheduleAddButton.addEventListener("click", function () {

    // 기존 입력값 초기화
    scheduleForm.reset();

    // 이전에 표시된 날짜/요일 초기화
    scheduleDateDisplay.textContent = "";

    openScheduleModal();

});


// X 버튼
scheduleModalCloseButton.addEventListener("click", function () {

    closeScheduleModal();

});


// 취소 버튼
scheduleCancelButton.addEventListener("click", function () {

    closeScheduleModal();

});


// 모달 바깥 영역 클릭
scheduleModalOverlay.addEventListener("click", function () {

    closeScheduleModal();

});

// =========================================================
// 다음 경기 일정 저장
// =========================================================

scheduleForm.addEventListener("submit", async function (event) {

    // 폼의 기본 새로고침 동작 막기
    event.preventDefault();

        // 경기 시간 검사
    if (!validateScheduleTime()) {
        return;
    }


// 입력값 가져오기
const scheduleData = {

    match_date:
        document.getElementById("scheduleDate").value,

    // 시작 시간
    start_time:
        document.getElementById("scheduleStartTime").value,

    // 종료 시간
    end_time:
        document.getElementById("scheduleEndTime").value,

    opponent:
        document.getElementById("scheduleOpponent").value.trim(),

    location:
        document.getElementById("scheduleLocation").value.trim(),

    memo:
        document.getElementById("scheduleMemo").value.trim()

};

    // 필수값 확인
   if (
    !scheduleData.match_date ||
    !scheduleData.start_time ||
    !scheduleData.end_time ||
    !scheduleData.opponent
) {

    alert("경기 날짜, 시작 시간, 종료 시간, 상대팀을 입력해주세요.");

    return;
}


    try {

        // 서버로 일정 등록 요청
        const response = await fetch("/api/schedules", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(scheduleData)

        });


        const result = await response.json();


        // 서버에서 오류가 발생한 경우
        if (!response.ok) {

            alert(
                result.message ||
                "경기 일정 등록에 실패했습니다."
            );

            return;
        }


        // 등록 성공
        alert("경기 일정이 등록되었습니다.");


        // 입력창 초기화
        scheduleForm.reset();


        // 팝업 닫기
        closeScheduleModal();


    } catch (error) {

        console.error(
            "경기 일정 등록 오류:",
            error
        );

        alert(
            "서버와 통신하는 중 오류가 발생했습니다."
        );

    }

});

// ---------------------------------------------------------
// + 경기 기록 추가 버튼
// ---------------------------------------------------------

addMatchButton.addEventListener(
    "click",
    openMatchModal
);


// ---------------------------------------------------------
// X 버튼
// ---------------------------------------------------------

modalCloseButton.addEventListener(
    "click",
    closeMatchModal
);


// ---------------------------------------------------------
// 취소 버튼
// ---------------------------------------------------------

cancelButton.addEventListener(
    "click",
    closeMatchModal
);


// ---------------------------------------------------------
// 팝업 바깥쪽 클릭
// ---------------------------------------------------------

modalOverlay.addEventListener(
    "click",
    closeMatchModal
);


// ---------------------------------------------------------
// ESC 키를 눌러도 닫기
// ---------------------------------------------------------

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Escape" &&
            matchModal.classList.contains("active")
        ) {

            closeMatchModal();

        }

    }
);


// ---------------------------------------------------------
// 경기 등록 버튼
// ---------------------------------------------------------
// 경기 등록
// ---------------------------------------------------------

matchForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        // 입력값 가져오기
        const matchData = {

            match_date:
                document.getElementById("matchDate").value,

            opponent:
                document.getElementById("opponent").value,

            location:
                document.getElementById("location").value,

            our_score:
                Number(
                    document.getElementById("ourScore").value
                ),

            opponent_score:
                Number(
                    document.getElementById("opponentScore").value
                ),

            memo:
                document.getElementById("memo").value

        };


        try {

    // 수정 중이면 PUT, 새 경기 등록이면 POST
const url = editingMatchId
    ? `/api/matches/${editingMatchId}`
    : "/api/matches";

const method = editingMatchId
    ? "PUT"
    : "POST";

const response = await fetch(url, {
    method: method,
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify(matchData)
});
            

            const result = await response.json();


            // 서버에서 오류가 발생한 경우
            if (!response.ok) {

                alert(
                    result.message ||
                    "경기 등록에 실패했습니다."
                );

                return;

            }


            // 등록 성공
            alert("⚽ 경기 기록이 등록되었습니다!");


            console.log(
                "등록된 경기:",
                result.data
            );


            // 입력 폼 초기화
            matchForm.reset();


            // 팝업 닫기
            closeMatchModal();

            // 수정 상태 초기화
            editingMatchId = null;

            // DB에서 경기 기록을 다시 불러와
// 최근 경기와 통계를 바로 갱신
            await loadMatches();


        } catch (error) {

            console.error(
                "경기 등록 오류:",
                error
            );


            alert(
                "서버와 통신하는 중 오류가 발생했습니다."
            );

        }

    }
);

// =========================================================
// DB 경기 기록 불러오기
// =========================================================

async function loadMatches() {

    try {

        // 서버에서 경기 기록 가져오기
        const response = await fetch("/api/matches");

        const result = await response.json();


        if (!response.ok) {

            throw new Error(
                result.message ||
                "경기 기록을 불러오지 못했습니다."
            );

        }


        // 서버에서 받은 경기 배열
        const matches = result.data;

        // 전체보기 기능에서 사용할 수 있도록
// 불러온 경기 데이터를 저장
        currentMatches = matches;

        // 최근 경기 화면 표시
        renderMatches(matches);


        // 상단 통계 계산 및 표시
        updateStats(matches);


    } catch (error) {

        console.error(
            "경기 기록 불러오기 오류:",
            error
        );


        const matchList =
            document.getElementById("matchList");


        matchList.innerHTML = `
            <div class="loading-message">
                경기 기록을 불러오지 못했습니다.
            </div>
        `;

    }

}


// =========================================================
// 최근 경기 기록 화면 출력
// =========================================================

function renderMatches(matches) {

    const matchList =
        document.getElementById("matchList");


    // 경기 기록이 하나도 없는 경우
    if (matches.length === 0) {

        matchList.innerHTML = `
            <div class="loading-message">
                아직 등록된 경기 기록이 없습니다.
            </div>
        `;

        return;

    }


    // 기존 내용 제거
    matchList.innerHTML = "";


    // ---------------------------------------------------------
// 최근 경기 / 전체 경기 선택
// ---------------------------------------------------------

// showAllMatches가 false면 최근 5경기
// showAllMatches가 true면 전체 경기
const displayMatches =
    showAllMatches
        ? matches
        : matches.slice(0, 5);


// 선택된 경기 목록 화면에 출력
displayMatches.forEach(function (match) {
        // ---------------------------------------------
        // 경기 날짜
        // ---------------------------------------------

        const date =
            new Date(match.match_date);


        const formattedDate =
            `${String(date.getMonth() + 1).padStart(2, "0")}.` +
            `${String(date.getDate()).padStart(2, "0")}`;


        // ---------------------------------------------
        // 승 / 무 / 패 한글 변환
        // ---------------------------------------------

        let resultText = "";
        let resultClass = "";


        if (match.result === "win") {

            resultText = "승";
            resultClass = "win";

        } else if (match.result === "draw") {

            resultText = "무";
            resultClass = "draw";

        } else {

            resultText = "패";
            resultClass = "lose";

        }


        // ---------------------------------------------
        // 경기 카드 생성
        // ---------------------------------------------

        const card =
            document.createElement("div");


        card.className = "match-card";


        card.innerHTML = `

            <div class="match-date">
                ${formattedDate}
            </div>


            <div class="match-teams">

                <strong>WGH</strong>

                <span class="match-score">
                    ${match.our_score}
                    :
                    ${match.opponent_score}
                </span>

                <strong>${escapeHtml(match.opponent)}</strong>

            </div>


            <div class="match-location">

                📍
                ${match.location
                    ? escapeHtml(match.location)
                    : "장소 미정"}

            </div>


            <div class="match-result ${resultClass}">
                ${resultText}
            </div>

            <div class="match-actions">

    <button
        type="button"
        class="edit-match-button"
        data-id="${match.match_id}"
    >
        수정
    </button>

    <button
        type="button"
        class="delete-match-button"
        data-id="${match.match_id}"
    >
        삭제
    </button>

    </div>
        `;


        matchList.appendChild(card);

    });

}


// =========================================================
// 상단 전적 통계 계산
// =========================================================

function updateStats(matches) {

    // 전체 경기 수
    const totalMatches =
        matches.length;


    // 승 / 무 / 패
    const wins =
        matches.filter(
            match => match.result === "win"
        ).length;


    const draws =
        matches.filter(
            match => match.result === "draw"
        ).length;


    const losses =
        matches.filter(
            match => match.result === "lose"
        ).length;


    // 총 득점
    const totalGoals =
        matches.reduce(
            (sum, match) =>
                sum + Number(match.our_score),
            0
        );


    // 총 실점
    const totalGoalsAgainst =
        matches.reduce(
            (sum, match) =>
                sum + Number(match.opponent_score),
            0
        );


    // 승률
    const winRate =
        totalMatches === 0
            ? 0
            : Math.round(
                (wins / totalMatches) * 100
            );


    // ---------------------------------------------
    // HTML에 표시
    // ---------------------------------------------

    document.getElementById(
        "totalMatches"
    ).textContent = totalMatches;


    document.getElementById(
        "wins"
    ).textContent = wins;


    document.getElementById(
        "draws"
    ).textContent = draws;


    document.getElementById(
        "losses"
    ).textContent = losses;


    document.getElementById(
        "winRate"
    ).textContent = `${winRate}%`;


    document.getElementById(
        "totalGoals"
    ).textContent = totalGoals;


    document.getElementById(
        "totalGoalsAgainst"
    ).textContent = totalGoalsAgainst;


    // ---------------------------------------------
    // 승률 원 그래프도 실제 승률에 맞게 변경
    // ---------------------------------------------

    const rateCircle =
        document.querySelector(".rate-circle");


    rateCircle.style.background = `
        conic-gradient(
            #3478f6 0% ${winRate}%,
            #dce7ff ${winRate}% 100%
        )
    `;

}


// =========================================================
// HTML 특수문자 처리
//
// 상대팀 / 장소에 HTML 문자가 들어가도
// 화면 구조가 깨지지 않도록 처리
// =========================================================

function escapeHtml(value) {

    const div =
        document.createElement("div");


    div.textContent =
        value ?? "";


    return div.innerHTML;

}


// =========================================================
// 페이지를 처음 열었을 때
// DB 경기 기록 자동 불러오기
// =========================================================

// ---------------------------------------------------------
// 전체보기 / 접기 버튼
// ---------------------------------------------------------

viewAllButton.addEventListener("click", function () {

    // false → true
    // true → false
    showAllMatches = !showAllMatches;


    // 저장해둔 경기 데이터로 목록 다시 출력
    renderMatches(currentMatches);


    // 현재 상태에 따라 버튼 글자 변경
    if (showAllMatches) {

        viewAllButton.textContent = "접기 ↑";

    } else {

        viewAllButton.textContent = "전체보기 ›";

    }

});

// =========================================================
// 경기 기록 수정 버튼
// =========================================================

document.addEventListener("click", function (event) {

    // 클릭한 요소가 수정 버튼이 아니면 종료
    if (!event.target.classList.contains("edit-match-button")) {
        return;
    }


    // 수정할 경기의 match_id 가져오기
    const matchId = Number(event.target.dataset.id);


    // 현재 불러와져 있는 경기 목록에서
    // 같은 match_id를 가진 경기 찾기
    const match = currentMatches.find(
        item => Number(item.match_id) === matchId
    );


    // 경기 정보를 찾지 못한 경우
    if (!match) {

        alert("수정할 경기 정보를 찾을 수 없습니다.");

        return;
    }


    // 현재 수정 중인 경기 번호 저장
    editingMatchId = matchId;


    // ---------------------------------------------------------
    // 기존 경기 정보를 입력창에 넣기
    // ---------------------------------------------------------

    // 날짜
    document.getElementById("matchDate").value =
        String(match.match_date).slice(0, 10);


    // 상대팀
    document.getElementById("opponent").value =
        match.opponent;


    // 장소
    document.getElementById("location").value =
        match.location || "";


    // WGH 점수
    document.getElementById("ourScore").value =
        match.our_score;


    // 상대팀 점수
    document.getElementById("opponentScore").value =
        match.opponent_score;


    // 메모
    document.getElementById("memo").value =
        match.memo || "";


    // 팝업 열기
    matchModal.classList.add("active");

    document.body.classList.add("modal-open");

});

// =========================================================
// 경기 기록 삭제
// =========================================================

document.addEventListener("click", async function (event) {

    // 클릭한 요소가 삭제 버튼이 아니면 종료
    if (!event.target.classList.contains("delete-match-button")) {
        return;
    }


    // 삭제 버튼에 저장된 match_id 가져오기
    const matchId = event.target.dataset.id;


    // 정말 삭제할 것인지 확인
    const isConfirmed = confirm(
        "이 경기 기록을 삭제하시겠습니까?"
    );


    // 취소를 누른 경우
    if (!isConfirmed) {
        return;
    }


    try {

        // 서버에 삭제 요청
        const response = await fetch(
            `/api/matches/${matchId}`,
            {
                method: "DELETE"
            }
        );


        const result = await response.json();


        // 서버에서 오류가 발생한 경우
        if (!response.ok) {

            alert(
                result.message ||
                "경기 기록 삭제에 실패했습니다."
            );

            return;
        }


        // 삭제 성공
        alert("경기 기록이 삭제되었습니다.");


        // DB에서 최신 경기 기록 다시 불러오기
        await loadMatches();


    } catch (error) {

        console.error(
            "경기 기록 삭제 오류:",
            error
        );


        alert(
            "서버와 통신하는 중 오류가 발생했습니다."
        );

    }

});

// =========================================================
// 다음 경기 일정 불러오기
// =========================================================

async function loadNextMatch() {

    try {

        // 서버에서 가장 가까운 다음 경기 1개 가져오기
        const response = await fetch("/api/schedules/next");

        const result = await response.json();


        // -------------------------------------------------
        // API 오류
        // -------------------------------------------------
        if (!response.ok || !result.success) {

            throw new Error(
                result.message || "다음 경기 조회 실패"
            );

        }


        // -------------------------------------------------
        // 예정된 경기가 없는 경우
        // -------------------------------------------------
        if (!result.data) {

            document.getElementById("nextMatchDate").textContent =
                "예정 없음";

            document.getElementById("nextMatchOpponent").textContent =
                "상대팀";

            document.getElementById("nextMatchTime").textContent =
                "시간 미정";

            document.getElementById("nextMatchLocation").textContent =
                "📍 장소 미정";

            return;
        }


        // -------------------------------------------------
        // 서버에서 받은 경기 데이터
        // -------------------------------------------------
        const schedule = result.data;


        const [year, month, day] =
    schedule.match_date.split("-");


// 요일 계산
const dateObject = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
);

const weekdays = [
    "일",
    "월",
    "화",
    "수",
    "목",
    "금",
    "토"
];

const weekday =
    weekdays[dateObject.getDay()];


// 예: 10월 14일 (수)
const formattedDate =
    `${Number(month)}월 ${Number(day)}일 (${weekday})`;

        // 시간
        // "20:00:00" → "20:00"
        const startTime =
            schedule.start_time.slice(0, 5);

        const endTime =
            schedule.end_time.slice(0, 5);


        // -------------------------------------------------
        // 화면에 표시
        // -------------------------------------------------

        document.getElementById("nextMatchDate").textContent =
            formattedDate;

        document.getElementById("nextMatchOpponent").textContent =
            schedule.opponent;

        document.getElementById("nextMatchTime").textContent =
            `⏰ ${startTime} ~ ${endTime}`;

        document.getElementById("nextMatchLocation").textContent =
            schedule.location
                ? `📍 ${schedule.location}`
                : "📍 장소 미정";


    } catch (error) {

        console.error(
            "❌ 다음 경기 불러오기 오류:",
            error
        );

    }

}

// =========================================================
// 경기 등록 팝업 - 참가 선수 목록 불러오기
// =========================================================

async function loadMatchPlayers() {

    try {

        // DB 선수 목록 가져오기
        const response = await fetch("/api/players");
        const result = await response.json();

        if (!response.ok || !result.success) {

            throw new Error(
                result.message || "선수 목록 조회 실패"
            );
        }


        // 선수 목록이 들어갈 영역
        const matchPlayerList =
            document.getElementById("matchPlayerList");


        // 기존 내용 삭제
        matchPlayerList.innerHTML = "";


        // 선수 한 명씩 생성
        result.data.forEach(player => {

            const playerRow =
                document.createElement("div");

            playerRow.className = "match-player-row";


            playerRow.innerHTML = `

                <!-- 참가 여부 -->
                <label class="match-player-check">

                    <input
                        type="checkbox"
                        class="match-player-checkbox"
                        value="${player.player_id}"
                    >

                    <span class="match-player-number">
                        ${player.back_number}
                    </span>

                    <strong class="match-player-name">
                        ${player.player_name}
                    </strong>

                </label>


                <!-- 득점 -->
                <label class="match-player-record">

                    <span>득점</span>

                    <input
                        type="number"
                        class="match-player-goals"
                        value="0"
                        min="0"
                        disabled
                    >

                </label>


                <!-- 도움 -->
                <label class="match-player-record">

                    <span>도움</span>

                    <input
                        type="number"
                        class="match-player-assists"
                        value="0"
                        min="0"
                        disabled
                    >

                </label>

            `;

            // 참가 선수 체크박스
const checkbox =
    playerRow.querySelector(".match-player-checkbox");

// 해당 선수의 득점 입력칸
const goalsInput =
    playerRow.querySelector(".match-player-goals");

// 해당 선수의 도움 입력칸
const assistsInput =
    playerRow.querySelector(".match-player-assists");


// 체크박스 변경 감지
checkbox.addEventListener("change", () => {

    if (checkbox.checked) {

        // 참가 선수 → 입력 가능
        goalsInput.disabled = false;
        assistsInput.disabled = false;

    } else {

        // 참가 취소 → 다시 잠금
        goalsInput.disabled = true;
        assistsInput.disabled = true;

        // 기록도 0으로 초기화
        goalsInput.value = 0;
        assistsInput.value = 0;
    }

});


            matchPlayerList.appendChild(playerRow);

        });


    } catch (error) {

        console.error(
            "❌ 참가 선수 목록 불러오기 오류:",
            error
        );

    }

}

// =========================================================
// 선수 목록 불러오기
// GET /api/players
// =========================================================

async function loadPlayers() {

    try {

        const response = await fetch("/api/players");
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "선수 목록 조회 실패"
            );
        }

        const playerList =
            document.getElementById("playerList");

        // 기존 내용 비우기
        playerList.innerHTML = "";

        // DB에 선수가 없는 경우
        if (result.data.length === 0) {

            playerList.innerHTML = `
                <p class="coming-soon">
                    등록된 선수가 없습니다.
                </p>
            `;

            return;
        }

        // DB 포지션 → 화면에 표시할 한글
        const positionNames = {
            GK: "골키퍼",
            FIXO: "픽소",
            ALA: "아라",
            PIVO: "피보"
        };

        // 선수 목록 생성
        result.data.forEach(player => {

            const playerItem =
                document.createElement("div");

            playerItem.className = "player-item";

           playerItem.innerHTML = `

    <!-- 선수 기본 정보 -->
    <div class="player-info">

        <!-- 등번호 -->
        <div class="player-number">
            ${player.back_number}
        </div>

        <!-- 이름 -->
        <strong class="player-name">
            ${player.player_name}
        </strong>

        <!-- 포지션 -->
        <span class="player-position">
            ${positionNames[player.position] || player.position}
        </span>

    </div>


   <!-- 선수 기록 -->
<div class="player-stats">

    <div class="player-stat">
        <span>출전</span>
        <strong>${player.appearances}</strong>
    </div>

    <div class="player-stat">
        <span>득점</span>
        <strong>${player.goals}</strong>
    </div>

    <div class="player-stat">
        <span>도움</span>
        <strong>${player.assists}</strong>
    </div>

</div>

`;

            playerList.appendChild(playerItem);
        });

    } catch (error) {

        console.error(
            "❌ 선수 목록 불러오기 오류:",
            error
        );
    }
}


// 경기 기록 불러오기
loadMatches();

//다음 경기 일정 불러오기
loadNextMatch();

loadPlayers();

loadMatchPlayers();