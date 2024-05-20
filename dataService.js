const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

client.connect()
  .then(() => console.log('Conexão com o banco de dados estabelecida'))
  .catch(err => console.error('Erro ao conectar ao banco de dados', err));

function getAllAlunos(callback) {
  client.query('SELECT * FROM alunos', (err, res) => {
    if (err) {
      console.error(err);
      return callback(err, null);
    }
    callback(null, res.rows);
  });
}

function addAluno(aluno, callback) {
  const { nome, turma, total_faltas } = aluno;
  client.query('INSERT INTO alunos (nome, turma, total_faltas) VALUES ($1, $2, $3)', [nome, turma, total_faltas], (err) => {
    if (err) {
      console.error(err);
      return callback(err);
    }
    callback(null);
  });
}

function updateAluno(id, aluno, callback) {
  const { nome, turma, total_faltas } = aluno;
  client.query('UPDATE alunos SET nome = $1, turma = $2, total_faltas = $3 WHERE id = $4', [nome, turma, total_faltas, id], (err, res) => {
    if (err) {
      console.error(err);
      return callback(err);
    }
    if (res.rowCount === 0) {
      return callback(new Error('Aluno não encontrado para atualização'));
    }
    callback(null);
  });
}

function removeAluno(id, callback) {
  client.query('DELETE FROM alunos WHERE id = $1', [id], (err, res) => {
    if (err) {
      console.error(err);
      return callback(err);
    }
    if (res.rowCount === 0) {
      return callback(new Error('Aluno não encontrado para remoção'));
    }
    callback(null);
  });
}

function registerPresenca(alunoId, data, presente, callback) {
  client.query('BEGIN', (err) => {
    if (err) {
      console.error('Erro ao iniciar a transação', err);
      return callback(err);
    }

    client.query('INSERT INTO presencas (aluno_id, data, presente) VALUES ($1, $2, $3)', [alunoId, data, presente], (err) => {
      if (err) {
        console.error('Erro ao inserir presença', err);
        return client.query('ROLLBACK', (errRollback) => {
          if (errRollback) {
            console.error('Erro ao fazer rollback', errRollback);
          }
          return callback(err);
        });
      }

      if (!presente) {
        client.query('UPDATE alunos SET total_faltas = total_faltas + 1 WHERE id = $1', [alunoId], (err) => {
          if (err) {
            console.error('Erro ao atualizar total_faltas', err);
            return client.query('ROLLBACK', (errRollback) => {
              if (errRollback) {
                console.error('Erro ao fazer rollback', errRollback);
              }
              return callback(err);
            });
          }

          client.query('COMMIT', (err) => {
            if (err) {
              console.error('Erro ao fazer commit', err);
              return callback(err);
            }
            callback(null);
          });
        });
      } else {
        client.query('COMMIT', (err) => {
          if (err) {
            console.error('Erro ao fazer commit', err);
            return callback(err);
          }
          callback(null);
        });
      }
    });
  });
}

function getFaltas(callback) {
  client.query(`
    SELECT presencas.id, presencas.aluno_id, presencas.data, presencas.presente, alunos.nome AS aluno_nome, alunos.turma, alunos.total_faltas
    FROM presencas
    JOIN alunos ON presencas.aluno_id = alunos.id
    ORDER BY presencas.data DESC
  `, (err, res) => {
    if (err) {
      console.error(err);
      return callback(err, null);
    }
    callback(null, res.rows);
  });
}

function getFilteredFaltas(filters, callback) {
  let query = `
    SELECT presencas.id, presencas.aluno_id, presencas.data, presencas.presente, alunos.nome AS aluno_nome, alunos.turma, alunos.total_faltas
    FROM presencas
    JOIN alunos ON presencas.aluno_id = alunos.id
  `;
  const conditions = [];
  const values = [];

  if (filters.nome) {
    conditions.push(`alunos.nome ILIKE $${values.length + 1}`);
    values.push(`%${filters.nome}%`);
  }
  if (filters.turma) {
    conditions.push(`alunos.turma = $${values.length + 1}`);
    values.push(filters.turma);
  }
  if (filters.data) {
    conditions.push(`presencas.data::date = $${values.length + 1}`);
    values.push(filters.data);
  }
  if (filters.presente !== undefined) {
    conditions.push(`presencas.presente = $${values.length + 1}`);
    values.push(filters.presente);
  }
  if (filters.total_faltas !== undefined) {
    conditions.push(`alunos.total_faltas = $${values.length + 1}`);
    values.push(filters.total_faltas);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ' ORDER BY presencas.data DESC';

  client.query(query, values, (err, res) => {
    if (err) {
      console.error(err);
      return callback(err, null);
    }
    callback(null, res.rows);
  });
}

module.exports = {
  getAllAlunos,
  addAluno,
  updateAluno,
  removeAluno,
  registerPresenca,
  getFaltas,
  getFilteredFaltas,
};
