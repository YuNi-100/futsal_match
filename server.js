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
// 7. 서버 실행
// =====================================================
app.listen(PORT, () => {

    console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);

});