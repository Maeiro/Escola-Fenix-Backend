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
  const { aluno, turma, data, totalFaltas, presente } = filters;

  let query = `
    SELECT presencas.id, presencas.aluno_id, presencas.data, presencas.presente, 
           alunos.nome AS aluno_nome, alunos.turma, alunos.total_faltas
    FROM presencas
    JOIN alunos ON presencas.aluno_id = alunos.id
    WHERE 1=1
  `;

  const queryParams = [];

  if (aluno) {
    queryParams.push(`%${aluno}%`);
    query += ` AND alunos.nome ILIKE $${queryParams.length}`;
  }

  if (turma) {
    queryParams.push(turma);
    query += ` AND alunos.turma = $${queryParams.length}`;
  }

  if (data) {
    queryParams.push(data);
    query += ` AND presencas.data::date = $${queryParams.length}`;
  }

  if (totalFaltas) {
    queryParams.push(totalFaltas);
    query += ` AND alunos.total_faltas = $${queryParams.length}`;
  }

  if (presente !== undefined && presente !== '') {
    queryParams.push(presente === 'true');
    query += ` AND presencas.presente = $${queryParams.length}`;
  }

  query += ` ORDER BY presencas.data DESC`;

  client.query(query, queryParams, (err, res) => {
    if (err) {
      console.error('Erro ao buscar presenças com filtros:', err);
      return callback(err, null);
    }
    callback(null, res.rows);
  });
}

function getFilteredAlunos(filters, callback) {
  const { id, nome, turma, totalFaltas } = filters;
  let query = 'SELECT * FROM alunos WHERE 1=1';
  const queryParams = [];

  if (id) {
    queryParams.push(id);
    query += ` AND id = $${queryParams.length}`;
  }
  if (nome) {
    queryParams.push(`%${nome}%`);
    query += ` AND nome ILIKE $${queryParams.length}`;
  }
  if (turma) {
    queryParams.push(turma);
    query += ` AND turma = $${queryParams.length}`;
  }
  if (totalFaltas) {
    queryParams.push(totalFaltas);
    query += ` AND total_faltas = $${queryParams.length}`;
  }

  client.query(query, queryParams, (err, res) => {
    if (err) {
      console.error(err);
      return callback(err, null);
    }
    callback(null, res.rows);
  });
}

function removePresenca(id, callback) {
  client.query('BEGIN', (err) => {
    if (err) {
      console.error('Erro ao iniciar a transação', err);
      return callback(err);
    }

    client.query('SELECT presente, aluno_id FROM presencas WHERE id = $1', [id], (err, res) => {
      if (err) {
        console.error('Erro ao buscar presença', err);
        return client.query('ROLLBACK', (errRollback) => {
          if (errRollback) {
            console.error('Erro ao fazer rollback', errRollback);
          }
          return callback(err);
        });
      }

      if (res.rowCount === 0) {
        return client.query('ROLLBACK', (errRollback) => {
          if (errRollback) {
            console.error('Erro ao fazer rollback', errRollback);
          }
          return callback(new Error('Presença não encontrada para remoção'));
        });
      }

      const { presente, aluno_id } = res.rows[0];

      client.query('DELETE FROM presencas WHERE id = $1', [id], (err, res) => {
        if (err) {
          console.error('Erro ao remover presença', err);
          return client.query('ROLLBACK', (errRollback) => {
            if (errRollback) {
              console.error('Erro ao fazer rollback', errRollback);
            }
            return callback(err);
          });
        }

        if (res.rowCount === 0) {
          return client.query('ROLLBACK', (errRollback) => {
            if (errRollback) {
              console.error('Erro ao fazer rollback', errRollback);
            }
            return callback(new Error('Presença não encontrada para remoção'));
          });
        }

        if (!presente) {
          client.query('UPDATE alunos SET total_faltas = total_faltas - 1 WHERE id = $1', [aluno_id], (err) => {
            if (err) {
              console.error('Erro ao atualizar total de faltas', err);
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
  });
}

function updatePresenca(id, presente, callback) {
  client.query('BEGIN', (err) => {
    if (err) {
      console.error('Erro ao iniciar a transação', err);
      return callback(err);
    }

    client.query('SELECT presente, aluno_id FROM presencas WHERE id = $1', [id], (err, res) => {
      if (err) {
        console.error('Erro ao buscar presença', err);
        return client.query('ROLLBACK', (errRollback) => {
          if (errRollback) {
            console.error('Erro ao fazer rollback', errRollback);
          }
          return callback(err);
        });
      }

      if (res.rowCount === 0) {
        return client.query('ROLLBACK', (errRollback) => {
          if (errRollback) {
            console.error('Erro ao fazer rollback', errRollback);
          }
          return callback(new Error('Presença não encontrada para atualização'));
        });
      }

      const { presente: oldPresente, aluno_id } = res.rows[0];

      if (presente === oldPresente) {
        return client.query('ROLLBACK', (errRollback) => {
          if (errRollback) {
            console.error('Erro ao fazer rollback', errRollback);
          }
          return callback(new Error('Nenhuma alteração na presença detectada'));
        });
      }

      const updateQuery = 'UPDATE presencas SET presente = $1 WHERE id = $2';
      client.query(updateQuery, [presente, id], (err) => {
        if (err) {
          console.error('Erro ao atualizar presença', err);
          return client.query('ROLLBACK', (errRollback) => {
            if (errRollback) {
              console.error('Erro ao fazer rollback', errRollback);
            }
            return callback(err);
          });
        }

        let faltasQuery;
        let faltasParams;

        if (presente) {
          faltasQuery = 'UPDATE alunos SET total_faltas = total_faltas - 1 WHERE id = $1';
          faltasParams = [aluno_id];
        } else {
          faltasQuery = 'UPDATE alunos SET total_faltas = total_faltas + 1 WHERE id = $1';
          faltasParams = [aluno_id];
        }

        client.query(faltasQuery, faltasParams, (err) => {
          if (err) {
            console.error('Erro ao atualizar total de faltas', err);
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
      });
    });
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
  getFilteredAlunos,
  removePresenca,
  updatePresenca
};
