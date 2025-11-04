const express = require('express');
const {Client}=require('pg');
const jwt= require('jsonwebtoken')
const bcrypt = require('bcrypt');
require('dotenv').config()
const JWT_SECRET = process.env.JWT_SECRET;
const {invalidInput,notFound}= require('./utils/errors')
const dbConfig={
    host:'localhost',
    port:5432,
    user:'postgres',
    password:'mypgpassword',
    database:'taskapi'
};

const app=express();
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});
const client=new Client(dbConfig);
app.use(express.json())
client.connect()
.then(()=>console.log('✅ Connected to PostgreSQL'))
.catch(err=>{
    console.error('❌ PostgreSQL connection error:', err);
    process.exit(1); // Crash if DB won't connect
})

function authenticateToken(req,res,next){
  const authHeader = req.headers['authorization'];
  const token=authHeader && authHeader.split(' ')[1];

  if(!token){
    return res.status(401).json({
      error:{
        code:'UNAUTHORIZED',
        message:'Access token required'
      }
    })
  }
  jwt.verify(token,JWT_SECRET,(err,user) =>{
    if(err){
      return res.status(403).json({
        error:{
          code:'FORBIDDEN',
          message:'Invalid or expired token'
        }
      });
    }
    req.user=user;
    next();
  })
}

app.post('/register',async (req,res) =>{
  const {email,password }=req.body;

  if(!email || typeof email !=='string' || email.trim()===''){
    return invalidInput(res,'Email is required');
  }
  if(!password || typeof password !=='string' || password.length<6){
    return invalidInput(res ,"passwrod is required and must be over 6 characters")
  }

  try{
    const existing = await client.query('SELECT id FROM users WHERE email = $1',[email])
    if(existing.rows.length>0){
      return invalidInput(res , 'User with this email already exists')
    }

    const hashedPasswrod= await bcrypt.hash(password,10);

    const result =await client.query(
      'INSERT INTO users (email , password) VALUES ($1 , $2) RETURNING id, email',[email.trim(), hashedPasswrod]
    );
    res.status(201).json(result.rows[0]);
  }catch(err){
    console.error('Registration error:', err);
    internalError(res, 'Failed to register user');
  }
})

app.post('/login',async(req,res)=>{
  const {email,password}=req.body;
  if (!email || typeof email !== 'string' || email.trim() === '') {
    return invalidInput(res, 'Email is required');
  }
  if (!password || typeof password !== 'string') {
    return invalidInput(res, 'Password is required');
  }

  try{
    const result=await client.query('SELECT id , email , password FROM users WHERE email = $1',[email]);
    if(result.rows.length === 0){
      return invalidInput(res,'Invalid email or password')
    }

    const user=result.rows[0];

    const isMatch = await bcrypt.compare(password,user.password);
    if(!isMatch){
      return invalidInput(res,'Invalid email or password');
    }
    const token = jwt.sign({userId:user.id},JWT_SECRET,{expiresIn:'1h'})
    res.json({
      token,user:{id:user.id,email:user.email}
    })
  }catch(err){
    console.error('Login error:', err);
    internalError(res, 'Failed to log in');
  }
})



app.get('/health',async(req,res)=>{
    try{
        await client.query('SELECT NOW()');
        res.json({status:'ok',db:'Connected'})
    }catch(err){
        console.error('Health check failed:', err);
        res.status(500).json({ status: 'ERROR', db: 'disconnected' })
    }
})


app.post('/tasks',authenticateToken, async (req, res) => {
  const { title } = req.body;
  const userId=req.user.userId;

  // Validation
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return invalidInput(res,'Title is required and must be a non-empty string')
  }

  try {

    const query = 'INSERT INTO tasks (title, user_id) VALUES ($1, $2) RETURNING *';
    const values = [title.trim(), userId];
    const result = await client.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

app.get('/tasks',authenticateToken,async(req,res)=>{
  const userId=req.user.userId

  try{
    const result=await client.query(
      'SELECT * FROM tasks WHERE user_id = $1 ORDER BY id',[userId]
    );
    res.json(result.rows)
  }catch(err){
    console.error('Fetch tasks error:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
})

app.patch('/tasks/:id',authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId=req.user.userId;
  const { title, completed } = req.body;

  // 1. Validate task ID
  const taskId = parseInt(id, 10);
  if (isNaN(taskId) || taskId <= 0) {
    return res.status(400).json({ error: 'Task ID must be a positive integer' });
  }


  // 3. Validate body: at least one field, and correct types
  if (title === undefined && completed === undefined) {
    return invalidInput(res,'AT least one of "title" or "completed" must be provided')
  }
  if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
    return res.status(400).json({ error: 'Title must be a non-empty string' });
  }
  if (completed !== undefined && typeof completed !== 'boolean') {
    return res.status(400).json({ error: 'Completed must be a boolean' });
  }

  // 4. Build dynamic query
  const fields = [];
  const values = [];
  let index = 1;

  if (title !== undefined) {
    fields.push(`title = $${index}`);
    values.push(title.trim());
    index++;
  }
  if (completed !== undefined) {
    fields.push(`completed = $${index}`);
    values.push(completed);
    index++;
  }

  // Add ownerId and taskId at the end
  values.push(userId, taskId);

  const query = `
    UPDATE tasks 
    SET ${fields.join(', ')} 
    WHERE id = $${index} AND user_id = $${index + 1} 
    RETURNING *
  `;

  try {
    const result = await client.query(query, values);
    if (result.rows.length === 0) {
      return notFound(res,'Task not found or access denied')
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

app.delete('/tasks/:id',authenticateToken,async(req,res)=>{
  const {id}=req.params;
  const userId=req.user.userId;
  const taskId=parseInt(id,10)
  if(isNaN(taskId) ||taskId <=0){
    return res.status(400).json({error:'id required and must be >0'})
  }
  
  try{
    const result=await client.query(
      'DELETE FROM tasks WHERE id=$1 AND user_id=$2 RETURNING *',[taskId,userId]
    );
    if(result.rows.length===0){
       return res.status(404).json({ error: 'Task not found or access denied' });
    }
    res.status(204).send();
  }catch(err){
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }

})


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});