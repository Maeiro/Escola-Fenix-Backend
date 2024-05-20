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

async function queryHandler(query, params = []) {
  try {
    console.log(`Executando query: ${query} com parâmetros: ${JSON.stringify(params)}`);
    const res = await client.query(query, params);
    console.log('Resultado da query:', res);
    return res.rows;
  } catch (err) {
    console.error('Erro ao executar query', err);
    throw err;
  }
}

async function getAllAlunos() {
  return queryHandler('SELECT * FROM alunos');
}

async function addAluno(aluno) {
  const { nome, turma, total_faltas } = aluno;
  await queryHandler('INSERT INTO alunos (nome, turma, total_faltas) VALUES ($1, $2, $3)', [nome, turma, total_faltas]);
}

async function updateAluno(id, aluno) {
  const { nome, turma, total_faltas } = aluno;
  const res = await queryHandler('UPDATE alunos SET nome = $1, turma = $2, total_faltas = $3 WHERE id = $4', [nome, turma, total_faltas, id]);
  if (res.rowCount === 0) throw new Error('Aluno não encontrado para atualização');
}

async function removeAluno(id) {
  try {
    await client.query('BEGIN');
    await queryHandler('DELETE FROM presencas WHERE aluno_id = $1', [id]);
    const res = await queryHandler('DELETE FROM alunos WHERE id = $1', [id]);
    if (res.rowCount === 0) throw new Error('Aluno não encontrado para remoção');
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function registerPresenca(alunoId, data, presente) {
  try {
    await client.query('BEGIN');
    const insertQuery = 'INSERT INTO presencas (aluno_id, data, presente) VALUES ($1, $2, $3) RETURNING *';
    const insertResult = await queryHandler(insertQuery, [alunoId, data, presente]);
    console.log('Resultado da inserção:', insertResult);

    if (!presente) {
      const updateQuery = 'UPDATE alunos SET total_faltas = total_faltas + 1 WHERE id = $1 RETURNING *';
      const updateResult = await queryHandler(updateQuery, [alunoId]);
      console.log('Resultado da atualização de faltas:', updateResult);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function getFaltas() {
  return queryHandler(`
    SELECT presencas.id, presencas.aluno_id, presencas.data, presencas.presente, 
           alunos.nome AS aluno_nome, alunos.turma, alunos.total_faltas
    FROM presencas
    JOIN alunos ON presencas.aluno_id = alunos.id
    ORDER BY presencas.data DESC
  `);
}

async function buildFilteredQuery(baseQuery, filters) {
  let query = baseQuery;
  const queryParams = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') {
      const column = key === 'presente' ? 'presencas.presente' :
        key === 'totalFaltas' ? 'alunos.total_faltas' :
          key === 'data' ? 'presencas.data' :
            key === 'aluno' ? 'alunos.nome' : `alunos.${key}`;
      const operator = (key === 'presente' || key === 'data' || key === 'totalFaltas') ? '=' : 'ILIKE';
      queryParams.push(operator === 'ILIKE' ? `%${value}%` : value);
      query += ` AND ${column} ${operator} $${queryParams.length}`;
    }
  }

  query += ' ORDER BY presencas.data DESC';
  return { query, queryParams };
}

async function getFilteredFaltas(filters) {
  const baseQuery = `
    SELECT presencas.id, presencas.aluno_id, presencas.data, presencas.presente, 
           alunos.nome AS aluno_nome, alunos.turma, alunos.total_faltas
    FROM presencas
    JOIN alunos ON presencas.aluno_id = alunos.id
    WHERE 1=1
  `;
  const { query, queryParams } = await buildFilteredQuery(baseQuery, filters);
  return queryHandler(query, queryParams);
}

async function getFilteredAlunos(filters) {
  const baseQuery = 'SELECT * FROM alunos WHERE 1=1';
  const { query, queryParams } = await buildFilteredQuery(baseQuery, filters);
  return queryHandler(query, queryParams);
}

async function removePresenca(id) {
  try {
    await client.query('BEGIN');
    const res = await queryHandler('SELECT presente, aluno_id FROM presencas WHERE id = $1', [id]);
    if (res.length === 0) throw new Error('Presença não encontrada para remoção');

    const { presente, aluno_id } = res[0];
    await queryHandler('DELETE FROM presencas WHERE id = $1', [id]);
    if (!presente) {
      await queryHandler('UPDATE alunos SET total_faltas = total_faltas - 1 WHERE id = $1', [aluno_id]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function updatePresenca(id, presente) {
  try {
    await client.query('BEGIN');
    const res = await queryHandler('SELECT presente, aluno_id FROM presencas WHERE id = $1', [id]);
    if (res.length === 0) throw new Error('Presença não encontrada para atualização');

    const { presente: oldPresente, aluno_id } = res[0];
    if (presente === oldPresente) throw new Error('Nenhuma alteração na presença detectada');

    await queryHandler('UPDATE presencas SET presente = $1 WHERE id = $2', [presente, id]);
    const faltasQuery = presente
      ? 'UPDATE alunos SET total_faltas = total_faltas - 1 WHERE id = $1'
      : 'UPDATE alunos SET total_faltas = total_faltas + 1 WHERE id = $1';
    await queryHandler(faltasQuery, [aluno_id]);
    await client.query('COMMIT');
  } catch (err) {
    console.error(err.message, err);
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Erro ao fazer rollback', rollbackErr);
    }
    throw err;
  }
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
