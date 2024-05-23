const { Client } = require('pg');

// Cria uma nova instância do cliente PostgreSQL.
const client = new Client({
  connectionString: process.env.DATABASE_URL, // Conexão com o banco de dados via URL especificada no ambiente.
  ssl: {
    rejectUnauthorized: false // Permite conexões SSL sem certificado autorizado.
  }
});

// Conecta ao banco de dados e registra sucesso ou erro.
client.connect()
  .then(() => console.log('Conexão com o banco de dados estabelecida'))
  .catch(err => console.error('Erro ao conectar ao banco de dados', err));

// Função para executar queries no banco de dados.
async function queryHandler(query, params = []) {
  try {
    const res = await client.query(query, params); // Executa a query com os parâmetros fornecidos.
    return res.rows; // Retorna as linhas resultantes da query.
  } catch (err) {
    console.error('Erro ao executar query', err); // Loga o erro caso a execução falhe.
    throw err; // Lança o erro para ser tratado pelo chamador.
  }
}

// Função para buscar todos os alunos.
async function getAllAlunos() {
  return queryHandler('SELECT * FROM alunos'); // Executa uma query para selecionar todos os alunos.
}

// Função para adicionar um novo aluno.
async function addAluno(aluno) {
  const { nome, turma, total_faltas } = aluno; // Extrai os dados do aluno.
  await queryHandler('INSERT INTO alunos (nome, turma, total_faltas) VALUES ($1, $2, $3)', [nome, turma, total_faltas]); // Insere o aluno no banco de dados.
}

// Função para atualizar um aluno existente.
async function updateAluno(id, aluno) {
  const { nome, turma, total_faltas } = aluno; // Extrai os dados do aluno.
  const res = await queryHandler('UPDATE alunos SET nome = $1, turma = $2, total_faltas = $3 WHERE id = $4', [nome, turma, total_faltas, id]); // Atualiza o aluno no banco de dados.
  if (res.rowCount === 0) throw new Error('Aluno não encontrado para atualização'); // Lança erro se o aluno não foi encontrado.
}

// Função para remover um aluno.
async function removeAluno(id) {
  try {
    await client.query('BEGIN'); // Inicia uma transação.
    await queryHandler('DELETE FROM presencas WHERE aluno_id = $1', [id]); // Remove todas as presenças do aluno.
    const res = await queryHandler('DELETE FROM alunos WHERE id = $1', [id]); // Remove o aluno.
    if (res.rowCount === 0) throw new Error('Aluno não encontrado para remoção'); // Lança erro se o aluno não foi encontrado.
    await client.query('COMMIT'); // Confirma a transação.
  } catch (err) {
    await client.query('ROLLBACK'); // Reverte a transação em caso de erro.
    throw err; // Lança o erro para ser tratado pelo chamador.
  }
}

// Função para registrar a presença de um aluno.
async function registerPresenca(alunoId, data, presente) {
  try {
    await client.query('BEGIN'); // Inicia uma transação.
    const insertQuery = 'INSERT INTO presencas (aluno_id, data, presente) VALUES ($1, $2, $3) RETURNING *'; // Query para inserir presença.
    const insertResult = await queryHandler(insertQuery, [alunoId, data, presente]); // Insere a presença no banco de dados.

    if (!presente) {
      const updateQuery = 'UPDATE alunos SET total_faltas = total_faltas + 1 WHERE id = $1 RETURNING *'; // Query para atualizar faltas.
      const updateResult = await queryHandler(updateQuery, [alunoId]); // Atualiza o total de presencas do aluno.
    }

    await client.query('COMMIT'); // Confirma a transação.
  } catch (err) {
    await client.query('ROLLBACK'); // Reverte a transação em caso de erro.
    throw err; // Lança o erro para ser tratado pelo chamador.
  }
}

// Função para buscar todas as presencas com paginação.
async function getPresencas(page = 1, limit = 10) {
  const offset = (page - 1) * limit;
  const totalPresencasQuery = 'SELECT COUNT(*) FROM presencas';
  const totalPresencasResult = await queryHandler(totalPresencasQuery);
  const totalItems = parseInt(totalPresencasResult[0].count, 10);

  const presencasQuery = `
    SELECT presencas.id, presencas.aluno_id, presencas.data, presencas.presente, 
           alunos.nome AS aluno_nome, alunos.turma, alunos.total_faltas
    FROM presencas
    JOIN alunos ON presencas.aluno_id = alunos.id
    ORDER BY presencas.data DESC
    LIMIT $1 OFFSET $2
  `;
  const presencas = await queryHandler(presencasQuery, [limit, offset]);

  return {
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
    currentPage: page,
    presencas
  };
}

// Função para construir uma query filtrada.
async function buildFilteredQuery(baseQuery, filters) {
  let query = baseQuery; // Base da query.
  const queryParams = []; // Parâmetros da query.

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') {
      const column = key === 'presente' ? 'presencas.presente' :
        key === 'total_faltas' ? 'alunos.total_faltas' :
          key === 'data' ? 'presencas.data' :
            key === 'aluno' ? 'alunos.nome' : `alunos.${key}`; // Determina a coluna correta para o filtro.
      const operator = (key === 'presente' || key === 'data' || key === 'total_faltas') ? '=' : 'ILIKE'; // Determina o operador.
      queryParams.push(operator === 'ILIKE' ? `%${value}%` : value); // Adiciona o valor do filtro aos parâmetros.
      query += ` AND ${column} ${operator} $${queryParams.length}`; // Adiciona a condição à query.
    }
  }

  query += ' ORDER BY presencas.data DESC'; // Adiciona a ordenação.
  return { query, queryParams }; // Retorna a query e os parâmetros.
}

// Função para buscar presencas com filtros.
async function getFilteredPresencas(filters) {
  const baseQuery = `
    SELECT presencas.id, presencas.aluno_id, presencas.data, presencas.presente, 
           alunos.nome AS aluno_nome, alunos.turma, alunos.total_faltas
    FROM presencas
    JOIN alunos ON presencas.aluno_id = alunos.id
    WHERE 1=1
  `; // Base da query.
  const { query, queryParams } = await buildFilteredQuery(baseQuery, filters); // Constrói a query filtrada.
  return queryHandler(query, queryParams); // Executa a query.
}

// Função para buscar alunos com filtros.
async function getFilteredAlunos(filters) {
  let query = 'SELECT * FROM alunos WHERE 1=1'; // Base da query.
  const queryParams = []; // Parâmetros da query.

  for (let [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') {
      let column;
      let operator;

      // Definindo a coluna e o operador com base no tipo de dado
      switch (key) {
        case 'id':
        case 'total_faltas':
          column = `alunos.${key}`;
          operator = '=';
          break;
        case 'nome':
        case 'turma':
          column = `alunos.${key}`;
          operator = 'ILIKE';
          value = `%${value}%`;
          break;
        default:
          column = `alunos.${key}`;
          operator = '=';
      }

      queryParams.push(value); // Adiciona o valor do filtro aos parâmetros.
      query += ` AND ${column} ${operator} $${queryParams.length}`; // Adiciona a condição à query.
    }
  }

  query += ' ORDER BY alunos.id'; // Adiciona a ordenação.

  return queryHandler(query, queryParams); // Executa a query.
}

// Função para remover uma presença.
async function removePresenca(id) {
  try {
    await client.query('BEGIN'); // Inicia uma transação.
    const res = await queryHandler('SELECT presente, aluno_id FROM presencas WHERE id = $1', [id]); // Busca a presença pelo ID.
    if (res.length === 0) throw new Error('Presença não encontrada para remoção'); // Lança erro se a presença não foi encontrada.

    const { presente, aluno_id } = res[0];
    await queryHandler('DELETE FROM presencas WHERE id = $1', [id]); // Remove a presença.
    if (!presente) {
      await queryHandler('UPDATE alunos SET total_faltas = total_faltas - 1 WHERE id = $1', [aluno_id]); // Atualiza o total de faltas se a presença era falsa.
    }
    await client.query('COMMIT'); // Confirma a transação.
  } catch (err) {
    await client.query('ROLLBACK'); // Reverte a transação em caso de erro.
    throw err; // Lança o erro para ser tratado pelo chamador.
  }
}

// Função para atualizar uma presença.
async function updatePresenca(id, presente) {
  try {
    await client.query('BEGIN'); // Inicia uma transação.
    const res = await queryHandler('SELECT presente, aluno_id FROM presencas WHERE id = $1', [id]); // Busca a presença pelo ID.
    if (res.length === 0) throw new Error('Presença não encontrada para atualização'); // Lança erro se a presença não foi encontrada.

    const { presente: oldPresente, aluno_id } = res[0];
    if (presente === oldPresente) throw new Error('Nenhuma alteração na presença detectada'); // Lança erro se não houve alteração.

    await queryHandler('UPDATE presencas SET presente = $1 WHERE id = $2', [presente, id]); // Atualiza a presença.
    const faltasQuery = presente
      ? 'UPDATE alunos SET total_faltas = total_faltas - 1 WHERE id = $1'
      : 'UPDATE alunos SET total_faltas = total_faltas + 1 WHERE id = $1'; // Query para atualizar faltas.
    await queryHandler(faltasQuery, [aluno_id]); // Atualiza o total de faltas do aluno.
    await client.query('COMMIT'); // Confirma a transação.
  } catch (err) {
    console.error(err.message, err); // Loga o erro.
    try {
      await client.query('ROLLBACK'); // Reverte a transação em caso de erro.
    } catch (rollbackErr) {
      console.error('Erro ao fazer rollback', rollbackErr); // Loga erro no rollback.
    }
    throw err; // Lança o erro para ser tratado pelo chamador.
  }
}

// Exporta as funções para uso em outros módulos.
module.exports = {
  getAllAlunos,
  addAluno,
  updateAluno,
  removeAluno,
  registerPresenca,
  getPresencas,
  getFilteredPresencas,
  getFilteredAlunos,
  removePresenca,
  updatePresenca
};
