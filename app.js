const session = require('express-session');
let express = require('express');
let app = express();
let mysql = require('mysql2');
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, 
  message: "<script>alert('요청이 너무 많습니다. 나중에 다시 시도해주세요'); history.back();</script>"
});

app.use(limiter);


app.set('view engine', 'ejs');
app.set('views', __dirname + '/templates');

function ifLogin(req, res, next) {
    if (!req.session.user) {
        return res.send("<script>alert('로그인 후 이용해주세요'); location.href='/login';</script>");
    }
    next();
}

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '1234',  
  database: 'users'  
});

db.connect((err) => {
  if (err) {
    console.error('DB 연결 실패:', err);
    return;
  }
  console.log('MySQL 연결 성공!');
});

app.use(session({
  secret: 'swaped',     
  resave: false,
  saveUninitialized: true
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('static'));

app.get('/',(req, res) => {
    res.render('index', { session: req.session });
});


app.get('/mypage/delete', ifLogin, (req, res) => {
    db.execute("DELETE FROM users WHERE id = ?", [req.session.user.id], (err, results) => {
        if (err) {
            console.log("처리 에러:", err);
            return res.send("에러 발생");
        }
        res.send("<script>alert('회원탈퇴가 완료되었습니다'); location.href='/';</script>");
    });
});

app.get('/mypage/edit', ifLogin, (req, res) => {
    res.sendFile(__dirname + "/templates/mypage_edit.html");
});
app.post('/mypage/edit', ifLogin, (req, res) => {
    const { name, email, password } = req.body;
    db.execute("UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?", [name, email, password, req.session.user.id], (err, results) => {
        if (err) {
            console.log("수정 에러:", err);
            return res.send("에러 발생");
        }
        console.log("수정 결과:", results);
        res.send("<script>alert('회원정보 수정이 완료되었습니다'); location.href='/';</script>");
    });
}
);

app.get('/mypage',ifLogin ,(req, res) => {
    db.execute("SELECT * FROM users WHERE id = ?", [req.session.user.id], (err, results) => {
        if (err) {
            console.log("마이페이지 에러:", err);
            return res.send("에러 발생");
        }
        console.log("마이페이지 결과:", results[0]);
        res.render('mypage', { user: results[0]});
    });
});

app.get('/board', ifLogin,(req, res)=> {
    db.execute("SELECT id, title FROM board ORDER BY id DESC", (err, results) => {
        if (err) {
            console.log("글 목록 에러:", err);
            return res.send("에러 발생");
        }
        res.render('board', { posts: results });
    });
});

app.get('/board/:num', ifLogin,(req, res) => {
    const postId = req.params.num;
    db.execute("SELECT id, title, password, writing FROM board WHERE id = ?", [postId], (err, result) => {
        if (err || result.length === 0) {
            console.log("상세 글 에러:", err);
            return res.send("글을 찾을 수 없습니다.");
        }
        res.render('board_detail', { post: result[0] });
    });
});

app.get('/board/:num/delete', (req, res) => {
  const postId = req.params.num;
  res.render('password_delete_check', { id: postId });
});

app.post('/board/:num/delete/check', (req, res) => {
  const postId = req.params.num;
  const { password } = req.body;

  db.execute("SELECT password FROM board WHERE id = ?", [postId], (err, result) => {
    if (err || result.length === 0) {
      return res.send("<script>alert('게시글을 찾을 수 없습니다'); location.href='/board';</script>");
    }

    if (result[0].password !== password) {
      return res.send("<script>alert('비밀번호가 틀렸습니다'); history.back();</script>");
    }

    db.execute("DELETE FROM board WHERE id = ?", [postId], (err2) => {
      if (err2) {
        return res.send("<script>alert('삭제 중 오류 발생'); location.href='/board';</script>");
      }

      res.send("<script>alert('게시글이 삭제되었습니다'); location.href='/board';</script>");
    });
  });
});

app.get('/board/:num/edit', (req, res) => {
  const postId = req.params.num;
  res.render('password_edit_check', { id: postId });
});

app.post('/board/:num/edit', (req, res) => {
  const postId = req.params.num;
  const { title, write } = req.body;

  db.execute("UPDATE board SET title = ?, writing = ? WHERE id = ?", [title, write, postId], (err) => {
    if (err) {
      return res.send("<script>alert('수정 중 오류 발생'); location.href='/board';</script>");
    }
    res.send(`<script>alert('글이 수정되었습니다'); location.href='/board/${postId}';</script>`);
  });
});

app.post('/board/:num/edit/check', (req, res) => {
  const postId = req.params.num;
  const { password } = req.body;

  db.execute("SELECT * FROM board WHERE id = ?", [postId], (err, result) => {
    if (err || result.length === 0) {
      return res.send("<script>alert('글을 찾을 수 없습니다'); location.href='/board';</script>");
    }

    if (result[0].password === password) {
      res.render('edit', { post: result[0] });
    } else {
      res.send("<script>alert('비밀번호가 틀렸습니다'); history.back();</script>");
    }
  });
});

app.get('/board_write', ifLogin,(req, res)=> {
    res.sendFile(__dirname + "/templates/board_write.html");
});

app.post('/board_write', ifLogin,(req, res) => {
    const { title, password, write } = req.body;
    db.execute(
        "INSERT INTO board (title, password, writing) VALUES (?, ?, ?)",
        [title, password, write],
        (err, results) => {
            if (err) {
                console.log("글 작성 오류:", err);
                return res.send("에러 발생");
            }
            console.log("게시글 작성 완료");
            res.send("<script>alert('게시판글 작성이 완료되었습니다'); location.href='/board';</script>");
        }
    );
});

app.get('/login', (req, res) => {
    res.sendFile(__dirname + "/templates/login.html");
});

app.get('/register', (req, res) => {
    res.sendFile(__dirname + "/templates/register.html");
});

app.post('/login', (req, res) => {
    const {id, password} = req.body;
    console.log(id, password);
    db.execute("SELECT * FROM users WHERE id = ? AND password = ?", [id, password], (err, results) => {
        if(err) {
            res.send("Error");
        }
        if(results.length > 0) {
            console.log(results);
            req.session.user = {
                id: results[0].id,
                name: results[0].name,
                email: results[0].email
            };
            req.session.save(() => {
                return res.send("<script>alert('로그인 성공'); location.href='/';</script>");
            });
        } else {
            res.send("<script>alert('비밀번호나 아이디가 틀립니다'); location.href='/';</script>");
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.log("세션 제거 실패:(", err);
        res.send("<script>alert('로그아웃 완료'); location.href='/';</script>");
    });
});

app.post("/register", (req, res)=> {
    const { name, email, id, password } = req.body;

    db.execute("SELECT * FROM users WHERE email = ? AND id = ?", [email, id], (err, results) => {
    if (err) {
        console.log("에러났음:", err);
        return;
    }

    if (results.length > 0) {
        res.send("<script>alert('이미 존재하는 유저입니다'); location.href='/login';</script>");
    } else {
        db.execute(
            "INSERT INTO users (name, email, id, password) VALUES (?, ?, ?, ?)",
            [name, email, id, password],
            (err, result) => {
                if (err) {
                    console.log("회원가입 에러...", err);
                    res.send("<script>alert('회원가입 에러...'); location.href='/login';</script>");
                    return;
                }
                if (result.affectedRows === 1) {
                    console.log("회원가입 성공");
                    console.log(result);
                    res.send("<script>alert('회원가입 성공!'); location.href='/login';</script>");
                }
            }
        );
    }   
});
    console.log(req.body);
});

app.listen(3000, () => {
    console.log("Runned 3000");
});

