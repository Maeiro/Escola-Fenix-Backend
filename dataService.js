//dataService.js

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

module.exports = {
  getAllAlunos,
  addAluno,
  updateAluno,
  removeAluno,
  registerPresenca,
};
