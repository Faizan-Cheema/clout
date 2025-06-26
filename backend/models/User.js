import pool from "../config/db.js";

class User {
  static async create({
    id,
    firstName,
    lastName,
    email,
    password,
    organization,
  }) {
    const query = `
      INSERT INTO users (id, first_name, last_name, email, password, organization)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [id, firstName, lastName, email, password, organization];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findByEmail(email) {
    const query = "SELECT * FROM users WHERE email = $1";
    const result = await pool.query(query, [email]);
    return result.rows[0];
  }

  static async storeToken(userId, token) {
    const query = `
      INSERT INTO user_tokens (user_id, account_token)
      VALUES ($1, $2)
      ON CONFLICT (user_id) 
      DO UPDATE SET account_token = $2
    `;
    await pool.query(query, [userId, token]);
  }

  static async removeToken(userId) {
    const query = "DELETE FROM user_tokens WHERE user_id = $1";
    await pool.query(query, [userId]);
  }

  static async findToken(userId) {
    const query = "SELECT account_token FROM user_tokens WHERE user_id = $1";
    const result = await pool.query(query, [userId]);
    return result.rows[0]?.account_token;
  }
}

export default User;
