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
// Home shows the five most recent matches only.

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

// =========================================================
// 현재 수정 중인 경기 일정 ID
// null = 새로운 일정 등록
// 숫자 = 기존 일정 수정
// =========================================================

let editingScheduleId = null;

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
    editingMatchId = null;
    matchForm.reset();
    prepareMatchPlayers(null);

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
    matchPlayersLoadVersion++;
    matchPlayersReady = false;

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

matchDate.addEventListener("click", function () {

    // 브라우저가 showPicker를 지원하는 경우
    if (typeof matchDate.showPicker === "function") {
        matchDate.showPicker();
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

    editingScheduleId = null;

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

      // =========================================================
// 경기 일정 등록 / 수정 자동 구분
// =========================================================

// 수정 중이면 기존 일정 API 사용
// 새 일정이면 등록 API 사용
const url = editingScheduleId !== null
    ? `/api/schedules/${editingScheduleId}`
    : "/api/schedules";

// 수정은 PUT, 등록은 POST
const method = editingScheduleId !== null
    ? "PUT"
    : "POST";

// 서버에 저장 요청
const response = await fetch(url, {

    method: method,

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
        await loadNextMatch();


        // 입력창 초기화
        scheduleForm.reset();


        // 팝업 닫기
        closeScheduleModal();

        editingScheduleId = null;


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

// Home, match list and detail use the shared creation/edit dialog in navigation.js.
// The original match modal supplies the shared form template.


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


        if (!matchPlayersReady) {
            alert("선수 기록을 불러온 후 저장해 주세요. 불러오기에 실패했다면 창을 다시 열어주세요.");
            return;
        }
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
    body: JSON.stringify({...matchData, players: collectMatchPlayers(), ...(!editingMatchId ? {video_id: document.getElementById("matchVideoSelect").value ? Number(document.getElementById("matchVideoSelect").value) : null} : {})})
});
            

            const result = await response.json();


            // 서버에서 오류가 발생한 경우
            if (!response.ok) {

                alert(
                    (typeof result.detail === "string" ? result.detail : result.message) ||
                    "경기 저장에 실패했습니다."
                );

                return;

            }


            // 등록 성공
            alert(editingMatchId ? "경기 기록이 수정되었습니다!" : "⚽ 경기 기록이 등록되었습니다!");


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
            await loadPlayers();


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
const displayMatches = matches.slice(0, 5);


// 선택된 경기 목록 화면에 출력
displayMatches.forEach(function (match) {
        // ---------------------------------------------
        // 경기 날짜
        // ---------------------------------------------

        const formattedDate =
            String(match.match_date).slice(0, 10);


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
        card.dataset.matchId = match.match_id;


        card.innerHTML = `

            <div class="home-match-league">
                ${match.league_name ? `<span class="league-badge">[${escapeHtml(match.league_name)}]</span>` : ''}
            </div>
            <div class="match-date">
                ${formattedDate}
            </div>


            <div class="match-teams">

                <strong data-team-name>${escapeHtml(match.team_name || 'WGH 은평')}</strong>

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


        const detailLink = document.createElement('a');
        detailLink.className = 'match-detail-link';
        detailLink.href = '/match.html?match_id=' + encodeURIComponent(match.match_id);
        detailLink.setAttribute('aria-label', `${match.match_date} ${match.team_name || 'WGH 은평'} 대 ${match.opponent} 경기 상세 보기`);
        card.querySelector('.match-actions').replaceWith(window.WGHRecordActions('match',match,async()=>{await loadMatches();await loadPlayers();}));
        card.querySelector('.match-location').title=match.location||'장소 미정';
        card.appendChild(detailLink);
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
    window.location.href = '/matches.html';
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
    prepareMatchPlayers(matchId);


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
        await loadPlayers();


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
// 다음 경기 일정 수정 버튼 클릭
// =========================================================


 // =========================================================
 // 다음 경기 일정 수정 / 삭제 버튼 클릭
 // =========================================================

document.addEventListener("click", async function (event) {

    // =====================================================
    // 1. 경기 일정 삭제 버튼 클릭
    // =====================================================

    const deleteButton = event.target.closest(".delete-schedule-button");

    if (deleteButton) {

        const scheduleId = Number(deleteButton.dataset.id);

        // 삭제 전 확인창
        const confirmed = confirm(
            "이 경기 일정을 삭제하시겠습니까?\n삭제한 일정은 복구할 수 없습니다."
        );

        // 취소를 누르면 아무것도 삭제하지 않음
        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(
                `/api/schedules/${scheduleId}`,
                {
                    method: "DELETE"
                }
            );

            if (!response.ok) {
                throw new Error("경기 일정 삭제 실패");
            }

            alert("경기 일정이 삭제되었습니다.");

            // 삭제 후 최신 일정 다시 불러오기
            await loadNextMatch();

        } catch (error) {
            console.error("경기 일정 삭제 오류:", error);
            alert("경기 일정을 삭제하지 못했습니다.");
        }

        return;
    }


    // =====================================================
    // 2. 경기 일정 수정 버튼 클릭 (기존 기능 유지)
    // =====================================================

    const editButton = event.target.closest(".edit-schedule-button");

    if (!editButton) {
        return;
    }

    // 수정할 일정 ID 가져오기
    const scheduleId = Number(editButton.dataset.id);

    // 불러온 일정 중 해당 일정 찾기
    const schedule = allUpcomingSchedules.find(
        item => Number(item.schedule_id) === scheduleId
    );

    if (!schedule) {
        alert("수정할 경기 일정을 찾을 수 없습니다.");
        return;
    }

    // 현재 수정 중인 일정 ID 저장
    editingScheduleId = scheduleId;

    // 기존 데이터 입력
    scheduleDateInput.value = schedule.match_date.slice(0, 10);
    scheduleStartTime.value = schedule.start_time.slice(0, 5);
    scheduleEndTime.value = schedule.end_time.slice(0, 5);

    document.getElementById("scheduleOpponent").value =
        schedule.opponent;

    document.getElementById("scheduleLocation").value =
        schedule.location || "";

    document.getElementById("scheduleMemo").value =
        schedule.memo || "";

    // 날짜와 요일 표시 갱신
    scheduleDateInput.dispatchEvent(new Event("change"));

    // 팝업 열기
    openScheduleModal();

});


// =========================================================
// 다음 경기 일정 불러오기
// =========================================================

// 전체 일정 조회 및 펼치기 상태
let allUpcomingSchedules = [];
let showAllSchedules = false;

function formatScheduleDate(value) {
    const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    return `${month}월 ${day}일 (${weekdays[date.getDay()]})`;
}

function renderUpcomingSchedules() {
    const first = allUpcomingSchedules[0];
    const button = document.getElementById("scheduleViewAllButton");
    const list = document.getElementById("additionalScheduleList");

    if (!first) {
        document.getElementById("nextMatchDate").textContent = "예정 없음";
        document.getElementById("nextMatchOpponent").textContent = "상대팀";
        document.getElementById("nextMatchTime").textContent = "시간 미정";
        document.getElementById("nextMatchLocation").textContent = "📍 장소 미정";
        button.hidden = true;
        list.hidden = true;
        list.replaceChildren();
        return;
    }

    document.getElementById("nextMatchDate").textContent = formatScheduleDate(first.match_date);
    document.getElementById("nextMatchOpponent").textContent = first.opponent;
    document.getElementById("nextMatchTime").textContent = `⏰ ${first.start_time.slice(0, 5)} ~ ${first.end_time.slice(0, 5)}`;
    document.getElementById("nextMatchLocation").textContent = first.location ? `📍 ${first.location}` : "📍 장소 미정";

    button.hidden = allUpcomingSchedules.length <= 1;
    button.textContent = showAllSchedules ? "접기 ↑" : "전체보기 ›";
    button.setAttribute("aria-expanded", String(showAllSchedules));
    list.hidden = !showAllSchedules || allUpcomingSchedules.length <= 1;
    list.replaceChildren();

    if (!showAllSchedules) return;

    allUpcomingSchedules.slice(1).forEach(schedule => {
        const item = document.createElement("div");
        item.className = "additional-schedule-item";
        const heading = document.createElement("div");
        heading.className = "additional-schedule-heading";
        const date = document.createElement("strong");
        date.className = "additional-schedule-date";
        date.textContent = formatScheduleDate(schedule.match_date);
        const time = document.createElement("span");
        time.className = "additional-schedule-time";
        time.textContent = `${schedule.start_time.slice(0, 5)} ~ ${schedule.end_time.slice(0, 5)}`;
        heading.append(date, time);
        const opponent = document.createElement("div");
        opponent.className = "additional-schedule-opponent";
        const ownTeam=document.createElement('span');ownTeam.dataset.teamName='';ownTeam.textContent=window.WGHClub.teamName;
        opponent.append(ownTeam,`  VS  ${schedule.opponent}`);
// =========================================================
// 추가 경기 일정 - 장소 / 메모 / 수정 버튼
// =========================================================

// 1. 장소: 시간 바로 아래에 표시
const location = document.createElement("div");
location.className = "additional-schedule-location";
location.textContent = schedule.location
    ? `📍 ${schedule.location}`
    : "📍 장소 미정";

// 시간과 장소를 오른쪽에 묶기
const scheduleInfo = document.createElement("div");
scheduleInfo.className = "additional-schedule-info";

// 기존 시간 요소와 장소를 묶음
scheduleInfo.append(time, location);

// 날짜와 오른쪽 정보 배치
heading.replaceChildren(date, scheduleInfo);

// 2. 메모: 내용이 있을 때만 표시
const memo = document.createElement("div");
memo.className = "additional-schedule-memo";

if (schedule.memo && schedule.memo.trim()) {
    memo.textContent = `📝 ${schedule.memo}`;
} else {
    memo.hidden = true;
}

// 3. 수정 버튼
const editButton = document.createElement("button");
editButton.type = "button";
editButton.className = "edit-schedule-button";
editButton.textContent = "수정";
editButton.dataset.id = schedule.schedule_id;

// 4. 버튼을 오른쪽 아래에 배치
const actions = document.createElement("div");
actions.className = "additional-schedule-actions";
actions.appendChild(editButton);

// 경기 일정 삭제 버튼 생성
const deleteButton = document.createElement("button");

deleteButton.type = "button";
deleteButton.className = "delete-schedule-button";
deleteButton.textContent = "삭제";
deleteButton.dataset.id = schedule.schedule_id;

// 수정 버튼 옆에 삭제 버튼 추가
actions.appendChild(deleteButton);

// 5. 카드 완성
item.append(heading, opponent, memo, actions);
list.appendChild(item);
    });
}



// 수정 버튼 클릭 이벤트 처리
document.addEventListener("click", (event) => {
    if (event.target.classList.contains("edit-schedule-button")) {
        editingScheduleId = parseInt(event.target.dataset.id);
        // The existing delegated handler above fills and opens the schedule form.
    }
});

document.getElementById("scheduleViewAllButton").addEventListener("click", () => {
    showAllSchedules = !showAllSchedules;
    renderUpcomingSchedules();
});

async function loadNextMatch() {
    try {
        const response = await fetch("/api/schedules");
        const result = await response.json();
        if (!response.ok || !result.success || !Array.isArray(result.data)) {
            throw new Error(result.message || "경기 일정 조회 실패");
        }
        allUpcomingSchedules = result.data;
        renderUpcomingSchedules();
    } catch (error) {
        console.error("경기 일정 불러오기 오류:", error);
    }
}

// =========================================================
// 경기 등록 팝업 - 참가 선수 목록 불러오기
// =========================================================

function renderMatchPlayerRows(players) {
        // 선수 목록이 들어갈 영역
        const matchPlayerList =
            document.getElementById("matchPlayerList");


        // 기존 내용 삭제
        matchPlayerList.innerHTML = "";


        // 선수 한 명씩 생성
        players.forEach(player => {

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
                        ${escapeHtml(player.player_name)}
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
                document.createElement("a");

            playerItem.className = "player-item";
            playerItem.href = '/player.html?player_id=' + encodeURIComponent(player.player_id);
            playerItem.setAttribute('aria-label', player.player_name + ' 선수 정보 보기');

           playerItem.innerHTML = `

    <!-- 선수 기본 정보 -->
    <div class="player-info">

        <!-- 등번호 -->
        <div class="player-number">
            <strong class="player-name jersey-name">${escapeHtml(player.player_name)}</strong>
            <span class="jersey-number">${escapeHtml(String(player.back_number))}</span>
        </div>

        <!-- 포지션 -->
        <span class="player-position">
            ${escapeHtml(positionNames[player.position] || player.position)}
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



let matchPlayersReady = false;
let matchPlayersLoadVersion = 0;
function collectMatchPlayers() {
    return [...document.querySelectorAll('#matchPlayerList .match-player-row')]
        .filter(row => row.querySelector('.match-player-checkbox').checked)
        .map(row => ({
            player_id: Number(row.querySelector('.match-player-checkbox').value),
            goals: Number(row.querySelector('.match-player-goals').value),
            assists: Number(row.querySelector('.match-player-assists').value)
        }));
}
async function prepareMatchPlayers(matchId) {
    document.querySelector('[data-match-video-picker]').hidden = matchId !== null;
    const version = ++matchPlayersLoadVersion;
    matchPlayersReady = false;
    const submit = matchForm.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;
    try {
        // Fetch first, then render once. Version check prevents a stale edit request
        // from overwriting a newly opened match form.
        const [playersResponse, recordsResponse] = await Promise.all([
            fetch('/api/players'),
            matchId === null ? Promise.resolve(null) : fetch(`/api/matches/${matchId}/players`)
        ]);
        const players = await playersResponse.json();
        const records = recordsResponse ? await recordsResponse.json() : {success:true,data:[]};
        if (!playersResponse.ok || !players.success || (recordsResponse && !recordsResponse.ok) || !records.success) {
            throw new Error('선수 기록을 불러오지 못했습니다. 창을 닫고 다시 열어주세요.');
        }
        if (version !== matchPlayersLoadVersion) return;
        renderMatchPlayerRows(players.data);
        const knownIds = new Set(players.data.map(player => Number(player.player_id)));
        if (records.data.some(record => !knownIds.has(Number(record.player_id)))) throw new Error('선수 목록과 경기 기록이 일치하지 않습니다. 저장하지 않고 확인해 주세요.');
        const stored = new Map(records.data.map(record => [Number(record.player_id),record]));
        document.querySelectorAll('#matchPlayerList .match-player-row').forEach(row => {
            const checkbox = row.querySelector('.match-player-checkbox');
            const record = stored.get(Number(checkbox.value));
            checkbox.checked = Boolean(record);
            checkbox.dispatchEvent(new Event('change'));
            if (record) {
                row.querySelector('.match-player-goals').value = record.goals;
                row.querySelector('.match-player-assists').value = record.assists;
            }
        });
        if (matchId === null) await window.WGHLoadMatchVideoOptions(document.getElementById("matchVideoSelect"), () => version === matchPlayersLoadVersion);
        if (version !== matchPlayersLoadVersion) return;
        matchPlayersReady = true;
        if (submit) submit.disabled = false;
    } catch (error) {
        if (version === matchPlayersLoadVersion) alert(error.message);
    }
}

// 경기 기록 불러오기
loadMatches();

//다음 경기 일정 불러오기
loadNextMatch();

loadPlayers();



window.addEventListener('wgh-record-created', event => {
    if (event.detail.kind === 'player') loadPlayers();
    if (event.detail.kind === 'match') { loadMatches(); loadPlayers(); }
});
window.addEventListener('wgh-club-changed',()=>{loadMatches();loadNextMatch();});
