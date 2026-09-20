import { db } from 'hatchable';

export const access = 'member';
export const methods = ['GET','PUT'];

export default async function(req,res){
  const userId=req.member?.id;
  if(!userId)return res.status(401).json({error:'unauthorized'});
  if(req.method==='GET'){
    const {rows}=await db.query('SELECT display_name FROM user_profiles WHERE user_id = $1',[userId]);
    return res.json({displayName: rows[0]?.display_name || ''});
  }
  const name=String(req.body?.displayName||'').trim().slice(0,80);
  if(!name)return res.status(400).json({error:'display_name_required'});
  const result=await db.query('INSERT INTO user_profiles (user_id, display_name, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = NOW() RETURNING display_name',[userId,name]);
  return res.json({ok:true,displayName:result.rows[0]?.display_name||name});
}