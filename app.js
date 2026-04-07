const express = require('express');
const app = express();
const userModel = require('./models/user');
const postModel = require('./models/post');
const bcrypt = require('bcrypt');
const path = require('path');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/like/:id', isLoggedIn, async (req, res) => {
    let post = await postModel.findOne({_id: req.params.id}).populate('user');

    if(post.likes.indexOf(req.user.userId)===-1) post.likes.push(req.user.userId);
    else post.likes.splice(post.likes.indexOf(req.user.userId), 1);
    await post.save();
    res.redirect('/profile');
});

app.get('/edit/:id', isLoggedIn, async (req, res) => {
    let post = await postModel.findOne({_id: req.params.id}).populate('user');
    res.render('edit', {post});
});

app.post('/edit/:id', isLoggedIn, async (req, res) => {
    let post = await postModel.findOneAndUpdate({_id: req.params.id}, {content: req.body.content})
    res.redirect('/profile');
});

app.get('/delete/:id', isLoggedIn, async (req, res) => {
    await postModel.findOneAndDelete({_id: req.params.id});
    res.redirect('/profile');
});

app.get('/profile', isLoggedIn, async (req, res) => { //protected route using isLoggedIn middleware
    let user = await userModel.findOne({username: req.user.username}).populate('posts');
    res.render('profile', {user});
});

app.get('/logout', (req, res) => {
    res.cookie('token','')
    res.redirect('/login');
});

app.post('/login',async (req,res) => {
    let {username, password} = req.body;

    let user = await userModel.findOne({username});
    if(!user) return res.status(500).send('Invalid credentials');

    bcrypt.compare(password, user.password, (err, result) => {
        if(result){
            let token = jwt.sign({username, userId: user._id},"secret");
            res.cookie('token', token).redirect('/profile');
        }
        else res.status(500).send('Invalid credentials');
    })
})

app.post('/register',async (req,res) => {
    let {username, name, email, age, password} = req.body;

    let user = await userModel.findOne({username});
    if(user) return res.status(500).send('Username already exists');

    bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(password, salt, async (err, hash) => {
            let user = await userModel.create({
                username,
                name,
                email,
                age,
                password: hash
            });
            let token = jwt.sign({username, userId: user._id},"secret");
            res.cookie('token', token).redirect('/profile');
        })
    })
})

app.post('/post', isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({username: req.user.username});
    let {content} = req.body;
    let post = await postModel.create({
        user: user._id,
        content
    })
    user.posts.push(post._id);
    await user.save();
    res.redirect('/profile');
})

function isLoggedIn(req,res,next){
    let token = req.cookies.token;
    if(!token) return res.send('Unauthorized');
    else{
        let data = jwt.verify(token, 'secret');
        req.user = data;
        next();
    }
}

app.listen(3000);