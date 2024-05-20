const { Client } = require('pg');

// Cria um cliente do PostgreSQL com a string de conexão fornecida e SSL habilitado
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Conecta ao banco de dados e exibe uma mensagem de sucesso ou erro
client.connect()
  .then(() => console.log('Conexão com o banco de dados estabelecida'))
  .catch(err => console.error('Erro ao conectar ao banco de dados', err));

// Função auxiliar para executar queries no banco de dados
async function queryHandler(query, params = []) {
  try {
    const res = await client.query(query, params); // Executa a query com os parâmetros fornecidos
    return res.rows; // Retorna as linhas do resultado
  } catch (err) {
    console.error('Erro ao executar query', err); // Exibe o erro no console
    throw err; // Lança o erro para ser tratado pelo chamador
  }
}

// Função para obter todos os alunos
async function getAllAlunos() {
  return queryHandler('SELECT * FROM alunos'); // Executa a query para selecionar todos os alunos
}

// Função para adicionar um novo aluno
async function addAluno(aluno) {
  const { nome, turma, total_faltas } = aluno;
  await queryHandler('INSERT INTO alunos (nome, turma, total_faltas) VALUES ($1, $2, $3)', [nome, turma, total_faltas]); // Insere um novo aluno no banco de dados
}

// Função para atualizar os dados de um aluno existente
async function updateAluno(id, aluno) {
  const { nome, turma, total_faltas } = aluno;
  const res = await queryHandler('UPDATE alunos SET nome = $1, turma = $2, total_faltas = $3 WHERE id = $4', [nome, turma, total_faltas, id]); // Atualiza os dados do aluno
  if (res.length === 0) throw new Error('Aluno não encontrado para atualização'); // Verifica se o aluno foi encontrado
}

// Função para remover um aluno
async function removeAluno(id) {
  const res = await queryHandler('DELETE FROM alunos WHERE id = $1', [id]); // Remove o aluno do banco de dados
  if (res.length === 0) throw new Error('Aluno não encontrado para remoção'); // Verifica se o aluno foi encontrado
}

// Função para registrar a presença de um aluno
async function registerPresenca(alunoId, data, presente) {
  try {
    await client.query('BEGIN'); // Inicia uma transação
    await queryHandler('INSERT INTO presencas (aluno_id, data, presente) VALUES ($1, $2, $3)', [alunoId, data, presente]); // Insere um registro de presença
    if (!presente) await queryHandler('UPDATE alunos SET total_faltas = total_faltas + 1 WHERE id = $1', [alunoId]); // Atualiza o total de faltas se o aluno não estiver presente
    await client.query('COMMIT'); // Comita a transação
  } catch (err) {
    await client.query('ROLLBACK'); // Faz rollback da transação em caso de erro
    throw err; // Lança o erro para ser tratado pelo chamador
  }
}

// Função para obter todas as faltas
async function getFaltas() {
  return queryHandler(`
    SELECT presencas.id, presencas.aluno_id, presencas.data, presencas.presente, 
           alunos.nome AS aluno_nome, alunos.turma, alunos.total_faltas
    FROM presencas
    JOIN alunos ON presencas.aluno_id = alunos.id
    ORDER BY presencas.data DESC
  `); // Executa a query para obter todas as faltas e os dados dos alunos associados
}

// Função auxiliar para construir queries filtradas
async function buildFilteredQuery(baseQuery, filters) {
  let query = baseQuery;
  const queryParams = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') {
      queryParams.push(key === 'presente' ? value === 'true' : `%${value}%`); // Adiciona o valor do filtro aos parâmetros da query
      query += ` AND ${key === 'presente' ? 'presencas.presente' : `alunos.${key}`} ${key === 'presente' ? '= $' : 'ILIKE $'}${queryParams.length}`; // Constrói a cláusula WHERE da query
    }
  }

  query += ' ORDER BY presencas.data DESC'; // Adiciona a cláusula ORDER BY
  return { query, queryParams }; // Retorna a query construída e os parâmetros
}

// Função para obter faltas filtradas
async function getFilteredFaltas(filters) {
  const baseQuery = `
    SELECT presencas.id, presencas.aluno_id, presencas.data, presencas.presente, 
           alunos.nome AS aluno_nome, alunos.turma, alunos.total_faltas
    FROM presencas
    JOIN alunos ON presencas.aluno_id = alunos.id
    WHERE 1=1
  `;
  const { query, queryParams } = await buildFilteredQuery(baseQuery, filters); // Constrói a query filtrada
  return queryHandler(query, queryParams); // Executa a query filtrada
}

// Função para obter alunos filtrados
async function getFilteredAlunos(filters) {
  const baseQuery = 'SELECT * FROM alunos WHERE 1=1';
  const { query, queryParams } = await buildFilteredQuery(baseQuery, filters); // Constrói a query filtrada
  return queryHandler(query, queryParams); // Executa a query filtrada
}

// Função para remover uma presença
async function removePresenca(id) {
  try {
    await client.query('BEGIN'); // Inicia uma transação
    const res = await queryHandler('SELECT presente, aluno_id FROM presencas WHERE id = $1', [id]); // Obtém os dados da presença
    if (res.length === 0) throw new Error('Presença não encontrada para remoção'); // Verifica se a presença foi encontrada

    const { presente, aluno_id } = res[0];
    await queryHandler('DELETE FROM presencas WHERE id = $1', [id]); // Remove a presença
    if (!presente) await queryHandler('UPDATE alunos SET total_faltas = total_faltas - 1 WHERE id = $1', [aluno_id]); // Atualiza o total de faltas se o aluno não estiver presente
    await client.query('COMMIT'); // Comita a transação
  } catch (err) {
    await client.query('ROLLBACK'); // Faz rollback da transação em caso de erro
    throw err; // Lança o erro para ser tratado pelo chamador
  }
}

// Função para atualizar a presença de um aluno
async function updatePresenca(id, presente) {
  try {
    await client.query('BEGIN'); // Inicia uma transação
    const res = await queryHandler('SELECT presente, aluno_id FROM presencas WHERE id = $1', [id]); // Obtém os dados da presença
    if (res.length === 0) throw new Error('Presença não encontrada para atualização'); // Verifica se a presença foi encontrada

    const { presente: oldPresente, aluno_id } = res[0];
    if (presente === oldPresente) throw new Error('Nenhuma alteração na presença detectada'); // Verifica se há alteração na presença

    await queryHandler('UPDATE presencas SET presente = $1 WHERE id = $2', [presente, id]); // Atualiza a presença
    const faltasQuery = presente
      ? 'UPDATE alunos SET total_faltas = total_faltas - 1 WHERE id = $1'
      : 'UPDATE alunos SET total_faltas = total_faltas + 1 WHERE id = $1'; // Define a query para atualizar o total de faltas
    await queryHandler(faltasQuery, [aluno_id]); // Executa a query para atualizar o total de faltas
    await client.query('COMMIT'); // Comita a transação
  } catch (err) {
    console.error(err.message, err); // Exibe o erro no console
    try {
      await client.query('ROLLBACK'); // Faz rollback da transação em caso de erro
    } catch (rollbackErr) {
      console.error('Erro ao fazer rollback', rollbackErr); // Exibe o erro de rollback no console
    }
    throw err; // Lança o erro para ser tratado pelo chamador
  }
}

// Exporta as funções para serem usadas em outros módulos
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
