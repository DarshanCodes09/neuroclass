const { query } = require('./db');

async function bootstrapDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS courses (
      id CHAR(36) PRIMARY KEY,
      course_code VARCHAR(20) NOT NULL,
      course_name VARCHAR(255) NOT NULL,
      academic_level VARCHAR(100),
      capacity INT DEFAULT 0,
      instructor_id VARCHAR(64) NOT NULL,
      instructor_name VARCHAR(255),
      status VARCHAR(30) DEFAULT 'draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS course_assets (
      id CHAR(36) PRIMARY KEY,
      course_id CHAR(36) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_type VARCHAR(50) NOT NULL,
      file_path VARCHAR(512) NOT NULL,
      extracted_text LONGTEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_course_assets_course_id (course_id),
      CONSTRAINT fk_course_assets_course
        FOREIGN KEY (course_id) REFERENCES courses(id)
        ON DELETE CASCADE
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS course_contents (
      id CHAR(36) PRIMARY KEY,
      course_id CHAR(36) NOT NULL,
      source_asset_id CHAR(36) NOT NULL,
      content_chunk TEXT NOT NULL,
      vector_json JSON NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_course_contents_course_id (course_id),
      CONSTRAINT fk_course_contents_course
        FOREIGN KEY (course_id) REFERENCES courses(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_course_contents_asset
        FOREIGN KEY (source_asset_id) REFERENCES course_assets(id)
        ON DELETE CASCADE
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ai_training_profiles (
      id CHAR(36) PRIMARY KEY,
      course_id CHAR(36) NOT NULL,
      instructor_id VARCHAR(64) NOT NULL,
      status VARCHAR(30) DEFAULT 'calibrating',
      rubric_json JSON NULL,
      vector_state JSON NULL,
      trained_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_ai_training_profile_course (course_id),
      CONSTRAINT fk_ai_training_course
        FOREIGN KEY (course_id) REFERENCES courses(id)
        ON DELETE CASCADE
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ai_rubric_files (
      id CHAR(36) PRIMARY KEY,
      profile_id CHAR(36) NOT NULL,
      course_id CHAR(36) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(512) NOT NULL,
      extracted_text LONGTEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_rubric_course_id (course_id),
      CONSTRAINT fk_rubric_profile
        FOREIGN KEY (profile_id) REFERENCES ai_training_profiles(id)
        ON DELETE CASCADE
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ai_gold_samples (
      id CHAR(36) PRIMARY KEY,
      profile_id CHAR(36) NOT NULL,
      course_id CHAR(36) NOT NULL,
      sample_type VARCHAR(20) NOT NULL,
      file_name VARCHAR(255) NULL,
      file_path VARCHAR(512) NULL,
      student_answer LONGTEXT NOT NULL,
      marks DECIMAL(6,2) NOT NULL,
      feedback TEXT NOT NULL,
      vector_json JSON NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_gold_course_id (course_id),
      CONSTRAINT fk_gold_profile
        FOREIGN KEY (profile_id) REFERENCES ai_training_profiles(id)
        ON DELETE CASCADE
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id CHAR(36) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      message TEXT NOT NULL,
      read_status TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_notifications_user (user_id, read_status, created_at)
    )
  `);
}

module.exports = {
  bootstrapDatabase,
};
