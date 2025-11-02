const express = require('express');
const {Client}=require('pg');
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

app.get('/health',async(req,res)=>{
    try{
        await client.query('SELECT NOW()');
        res.json({status:'ok',db:'Connected'})
    }catch(err){
        console.error('Health check failed:', err);
        res.status(500).json({ status: 'ERROR', db: 'disconnected' })
    }
})


app.post('/tasks', async (req, res) => {
  const { title, user_id } = req.body;

  // Validation
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return invalidInput(res,'Title is required and must be a non-empty string')
  }
  if (!Number.isInteger(user_id) || user_id <= 0) {
    return res.status(400).json({ error: 'user_id must be a positive integer' });
  }

  try {
    // 🔍 FIRST: Check if user exists
    const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [user_id]);
    if (userCheck.rows.length === 0) {
      return res.status(400).json({ error: 'User not found' });
    }

    // ✅ THEN: Insert the task
    const query = 'INSERT INTO tasks (title, user_id) VALUES ($1, $2) RETURNING *';
    const values = [title.trim(), user_id];
    const result = await client.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

app.get('/tasks',async(req,res)=>{
  const {user_id}=req.query;

  const userId=parseInt(user_id,10);
  if(isNaN(userId)||userId<=0){
    return res.status(400).json({error:'user_id must be positive integer'});
  }

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

app.patch('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.query; // simulate ownership
  const { title, completed } = req.body;

  // 1. Validate task ID
  const taskId = parseInt(id, 10);
  if (isNaN(taskId) || taskId <= 0) {
    return res.status(400).json({ error: 'Task ID must be a positive integer' });
  }

  // 2. Validate user_id (simulated owner)
  const ownerId = parseInt(user_id, 10);
  if (isNaN(ownerId) || ownerId <= 0) {
    return res.status(400).json({ error: 'user_id must be a positive integer' });
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
  values.push(ownerId, taskId);

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

app.delete('/tasks/:id',async(req,res)=>{
  const {id}=req.params;
  const {user_id}=req.query;
  const taskId=parseInt(id,10)
  const ownedId=parseInt(user_id,10)
  if(isNaN(taskId) ||taskId <=0){
    return res.status(400).json({error:'id required and must be >0'})
  }
  if(isNaN(ownedId)||ownedId <=0){
    return res.status(400).json({error:'user_id required and must be >0'}) 
  }
  try{
    const result=await client.query(
      'DELETE FROM tasks WHERE id=$1 AND user_id=$2 RETURNING *',[taskId,ownedId]
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