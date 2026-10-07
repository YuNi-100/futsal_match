// =====================================================
// 1. 환경변수(.env) 불러오기
// =====================================================
require('dotenv').config();


// =====================================================
// 2. 필요한 모듈 불러오기
// =====================================================
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');


// =====================================================
// 3. Express 서버 생성
// =====================================================
const app = express();
const PORT = 3000;


// =====================================================
// 4. MySQL 연결 설정
// =====================================================
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// =====================================================
// JSON 데이터 사용 설정
// 브라우저에서 보낸 경기 등록 데이터를 읽기 위해 필요
// =====================================================
app.use(express.json());


// =====================================================
// 5. public 폴더 사용 설정
// =====================================================
app.use(express.static(path.join(__dirname, 'public')));


// =====================================================
// 6. MySQL 연결 테스트
// =====================================================
async function testDatabaseConnection() {

    try {

        const connection = await pool.getConnection();

        console.log('✅ MySQL 연결 성공!');
        console.log('⚽ futsaldb 연결 완료!');

        connection.release();

    } catch (error) {

        console.error('❌ MySQL 연결 실패');
        console.error(error.message);

    }
}

testDatabaseConnection();

// =====================================================
// 7. 경기 기록 조회 API
// =====================================================

app.get('/api/matches', async (req, res) => {

    try {

        // futsal_match 테이블에서 경기 기록 조회
        const [rows] = await pool.query(`
            SELECT
                match_id,
                match_date,
                opponent,
                our_score,
                opponent_score,
                location,
                result,
                memo
            FROM futsal_match
            ORDER BY match_date DESC
        `);

        // 조회한 데이터를 JSON으로 전달
        res.json({
            success: true,
            data: rows
        });

    } catch (error) {

        console.error('❌ 경기 기록 조회 실패:', error.message);

        res.status(500).json({
            success: false,
            message: '경기 기록을 불러오지 못했습니다.'
        });
    }

});

// =====================================================
// 8. 경기 기록 등록 API
// =====================================================

app.post('/api/matches', async (req, res) => {

    try {

        // -------------------------------------------------
        // 브라우저에서 전달받은 경기 정보
        // -------------------------------------------------
        const {
            match_date,
            opponent,
            our_score,
            opponent_score,
            location,
            memo
        } = req.body;


        // -------------------------------------------------
        // 필수 입력값 확인
        // -------------------------------------------------
        if (
            !match_date ||
            !opponent ||
            our_score === undefined ||
            opponent_score === undefined
        ) {

            return res.status(400).json({
                success: false,
                message: '필수 경기 정보를 입력해주세요.'
            });

        }


        // -------------------------------------------------
        // 점수를 숫자로 변환
        // -------------------------------------------------
        const ourScore = Number(our_score);
        const opponentScore = Number(opponent_score);


        // 점수가 정상적인 숫자인지 확인
        if (
            !Number.isInteger(ourScore) ||
            !Number.isInteger(opponentScore) ||
            ourScore < 0 ||
            opponentScore < 0
        ) {

            return res.status(400).json({
                success: false,
                message: '점수는 0 이상의 정수만 입력할 수 있습니다.'
            });

        }


        // -------------------------------------------------
        // 승 / 무 / 패 자동 계산
        // -------------------------------------------------
        let result;

        if (ourScore > opponentScore) {

            result = 'win';

        } else if (ourScore === opponentScore) {

            result = 'draw';

        } else {

            result = 'lose';

        }


        // -------------------------------------------------
        // 현재는 테스트 사용자 1번 사용
        //
        // 나중에 로그인 기능을 만들면
        // 로그인한 사용자의 user_id로 변경
        // -------------------------------------------------
        const userId = 1;


        // -------------------------------------------------
        // MySQL에 경기 기록 저장
        // -------------------------------------------------
        const [insertResult] = await pool.execute(
            `
            INSERT INTO futsal_match
            (
                user_id,
                match_date,
                opponent,
                our_score,
                opponent_score,
                location,
                result,
                memo
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                userId,
                match_date,
                opponent.trim(),
                ourScore,
                opponentScore,
                location?.trim() || null,
                result,
                memo?.trim() || null
            ]
        );


        console.log(
            `⚽ 경기 등록 완료: ${ourScore} : ${opponentScore} (${result})`
        );


        // -------------------------------------------------
        // 브라우저에 성공 결과 전달
        // -------------------------------------------------
        res.status(201).json({

            success: true,

            message: '경기 기록이 등록되었습니다.',

            data: {
                match_id: insertResult.insertId,
                match_date,
                opponent: opponent.trim(),
                our_score: ourScore,
                opponent_score: opponentScore,
                location: location?.trim() || null,
                result,
                memo: memo?.trim() || null
            }

        });


    } catch (error) {

        console.error(
            '❌ 경기 기록 등록 실패:',
            error.message
        );


        res.status(500).json({
            success: false,
            message: '경기 기록을 저장하지 못했습니다.'
        });

    }

});
// =========================================================
// 경기 기록 수정
// PUT /api/matches/:id
// =========================================================

app.put('/api/matches/:id', async (req, res) => {

    // 수정할 경기 번호
    const matchId = Number(req.params.id);


    // 입력받은 경기 정보
    const {
        match_date,
        opponent,
        our_score,
        opponent_score,
        location,
        memo
    } = req.body;


    // 경기 번호 확인
    if (!Number.isInteger(matchId) || matchId <= 0) {

        return res.status(400).json({
            success: false,
            message: '올바르지 않은 경기 번호입니다.'
        });

    }


    // 필수 입력값 확인
    if (
        !match_date ||
        !opponent ||
        our_score === undefined ||
        opponent_score === undefined
    ) {

        return res.status(400).json({
            success: false,
            message: '필수 경기 정보를 입력해주세요.'
        });

    }


    // 점수를 숫자로 변환
    const ourScore = Number(our_score);
    const opponentScore = Number(opponent_score);


    // 점수 확인
    if (
        !Number.isInteger(ourScore) ||
        !Number.isInteger(opponentScore) ||
        ourScore < 0 ||
        opponentScore < 0
    ) {

        return res.status(400).json({
            success: false,
            message: '점수는 0 이상의 정수로 입력해주세요.'
        });

    }


    // ---------------------------------------------------------
    // 수정된 점수 기준으로 승 / 무 / 패 자동 계산
    // ---------------------------------------------------------

    let result;

    if (ourScore > opponentScore) {

        result = 'win';

    } else if (ourScore === opponentScore) {

        result = 'draw';

    } else {

        result = 'lose';

    }


    try {

        // ---------------------------------------------------------
        // DB 경기 기록 수정
        // ---------------------------------------------------------

        const [updateResult] = await pool.query(
            `
            UPDATE futsal_match

            SET
                match_date = ?,
                opponent = ?,
                our_score = ?,
                opponent_score = ?,
                location = ?,
                result = ?,
                memo = ?

            WHERE match_id = ?
            `,
            [
                match_date,
                opponent.trim(),
                ourScore,
                opponentScore,
                location?.trim() || null,
                result,
                memo?.trim() || null,
                matchId
            ]
        );


        // 수정할 경기를 찾지 못한 경우
        if (updateResult.affectedRows === 0) {

            return res.status(404).json({
                success: false,
                message: '수정할 경기 기록을 찾을 수 없습니다.'
            });

        }


        // 수정 성공
        res.json({
            success: true,
            message: '경기 기록이 수정되었습니다.',
            data: {
                match_id: matchId,
                match_date,
                opponent: opponent.trim(),
                our_score: ourScore,
                opponent_score: opponentScore,
                location: location?.trim() || null,
                result,
                memo: memo?.trim() || null
            }
        });


    } catch (error) {

        console.error(
            '경기 기록 수정 오류:',
            error
        );


        res.status(500).json({
            success: false,
            message: '경기 기록 수정 중 오류가 발생했습니다.'
        });

    }

});


// =========================================================
// 경기 기록 삭제
// DELETE /api/matches/:id
// =========================================================

app.delete('/api/matches/:id', async (req, res) => {

    // URL에서 삭제할 경기 번호(match_id) 가져오기
    const matchId = Number(req.params.id);


    // 경기 번호가 올바르지 않은 경우
    if (!Number.isInteger(matchId) || matchId <= 0) {

        return res.status(400).json({
            success: false,
            message: '올바르지 않은 경기 번호입니다.'
        });

    }


    try {

        // 해당 match_id의 경기 기록 삭제
        const [result] = await pool.query(
            `
            DELETE FROM futsal_match
            WHERE match_id = ?
            `,
            [matchId]
        );


        // 삭제할 경기 기록을 찾지 못한 경우
        if (result.affectedRows === 0) {

            return res.status(404).json({
                success: false,
                message: '삭제할 경기 기록을 찾을 수 없습니다.'
            });

        }


        // 삭제 성공
        res.json({
            success: true,
            message: '경기 기록이 삭제되었습니다.'
        });


    } catch (error) {

        console.error(
            '경기 기록 삭제 오류:',
            error
        );


        res.status(500).json({
            success: false,
            message: '경기 기록 삭제 중 오류가 발생했습니다.'
        });

    }

});

// =========================================================
// 다음 경기 일정 등록
// POST /api/schedules
// =========================================================

app.post('/api/schedules', async (req, res) => {

    const {
        match_date,
        start_time,
        end_time,
        opponent,
        location,
        memo
    } = req.body;


    // -----------------------------------------------------
    // 필수 입력값 확인
    // -----------------------------------------------------
    if (
        !match_date ||
        !start_time ||
        !end_time ||
        !opponent
    ) {
        return res.status(400).json({
            success: false,
            message: '경기 날짜, 시작 시간, 종료 시간, 상대팀을 입력해주세요.'
        });
    }


    // -----------------------------------------------------
    // 시작 시간 / 종료 시간 확인
    // 예: 22:00 < 23:30
    // -----------------------------------------------------
    if (start_time >= end_time) {
        return res.status(400).json({
            success: false,
            message: '종료 시간은 시작 시간보다 늦어야 합니다.'
        });
    }


    // 현재는 테스트 사용자 1번 사용
    // 나중에 로그인 기능 구현 시 로그인 사용자 ID로 변경
    const userId = 1;


    try {

        // -------------------------------------------------
        // DB에 다음 경기 일정 저장
        // -------------------------------------------------
        const [result] = await pool.query(
            `
                INSERT INTO futsal_schedule
                (
                    user_id,
                    match_date,
                    start_time,
                    end_time,
                    opponent,
                    location,
                    memo
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
                userId,
                match_date,
                start_time,
                end_time,
                opponent.trim(),
                location?.trim() || null,
                memo?.trim() || null
            ]
        );


        console.log(
            `🗓 일정 등록 완료: ${match_date} ${start_time} ~ ${end_time} / ${opponent}`
        );


        res.status(201).json({
            success: true,
            message: '다음 경기 일정이 등록되었습니다.',

            data: {
                schedule_id: result.insertId,
                match_date,
                start_time,
                end_time,
                opponent: opponent.trim(),
                location: location?.trim() || null,
                memo: memo?.trim() || null
            }
        });


    } catch (error) {

        console.error(
            '❌ 경기 일정 등록 오류:',
            error
        );

        res.status(500).json({
            success: false,
            message: '경기 일정 등록 중 오류가 발생했습니다.'
        });
    }
});

// =========================================================
// 가장 가까운 다음 경기 조회
// GET /api/schedules/next
// =========================================================

app.get('/api/schedules/next', async (req, res) => {

    // 현재는 테스트 사용자 1번 사용
    const userId = 1;

    try {

        const [rows] = await pool.query(
            `
                SELECT
    schedule_id,
    DATE_FORMAT(match_date, '%Y-%m-%d') AS match_date,
    start_time,
    end_time,
    opponent,
    location,
    memo
                FROM futsal_schedule
                WHERE user_id = ?
                  AND match_date >= CURDATE()
                ORDER BY
                    match_date ASC,
                    start_time ASC
                LIMIT 1
            `,
            [userId]
        );


        // 예정된 경기가 없는 경우
        if (rows.length === 0) {

            return res.json({
                success: true,
                data: null
            });
        }


        // 가장 가까운 경기 1개 전달
        res.json({
            success: true,
            data: rows[0]
        });


    } catch (error) {

        console.error(
            '❌ 다음 경기 조회 오류:',
            error
        );

        res.status(500).json({
            success: false,
            message: '다음 경기 일정을 불러오지 못했습니다.'
        });

    }

});

// =========================================================
// 선수 목록 + 누적 경기 기록 조회
// GET /api/players
// =========================================================

app.get('/api/players', async (req, res) => {

    try {

        const [rows] = await pool.query(
            `
                SELECT
                    p.player_id,
                    p.player_name,
                    p.back_number,
                    p.position,

                    COUNT(mp.match_player_id) AS appearances,

                    COALESCE(SUM(mp.goals), 0) AS goals,

                    COALESCE(SUM(mp.assists), 0) AS assists

                FROM futsal_player p

                LEFT JOIN match_player mp
                    ON p.player_id = mp.player_id

                GROUP BY
                    p.player_id,
                    p.player_name,
                    p.back_number,
                    p.position

                ORDER BY p.back_number ASC
            `
        );

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {

        console.error(
            '❌ 선수 목록 조회 오류:',
            error
        );

        res.status(500).json({
            success: false,
            message: '선수 목록을 불러오지 못했습니다.'
        });
    }
});

// =====================================================
// 7. 서버 실행
// =====================================================
app.listen(PORT, () => {

    console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);

});