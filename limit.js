import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
	windowMs: 1000 ,
	max: 1,
	standardHeaders: true, 
	legacyHeaders: false, 
    message: 'DDos 방어'
});

export {
	limiter
}