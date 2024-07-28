const pool = require('../config/db.config');

const createUser = async (profile) => {
  const query = `
    INSERT INTO users (id, email, first_name, last_name, connection_id, connection_type, idp_id, raw_attributes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id) 
    DO UPDATE SET 
      email = EXCLUDED.email,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      connection_id = EXCLUDED.connection_id,
      connection_type = EXCLUDED.connection_type,
      idp_id = EXCLUDED.idp_id,
      raw_attributes = EXCLUDED.raw_attributes
    RETURNING *;
  `;
  
  const values = [
    profile.id,
    profile.email,
    profile.first_name,
    profile.last_name,
    profile.connection_id,
    profile.connection_type,
    profile.idp_id,
    profile.raw_attributes,
  ];

  try {
    const res = await pool.query(query, values);
    return res.rows[0];
  } catch (err) {
    console.error(err);
    throw new Error('Error creating or updating user');
  }
};

module.exports = {
  createUser,
};
