// server.js

const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3002;
const dataService = require('./dataService.js');

app.use(cors());
app.use(express.json());

// Rota para verificar se o backend está funcionando
app.get('/', (req, res) => {
  res.send('Backend funcionando!');
});

// Rota para buscar todos os alunos
app.get('/alunos', async (req, res) => {
  try {
    const alunos = await dataService.getAllAlunos();
    res.json(alunos);
  } catch (err) {
    res.status(500).send('Erro ao buscar alunos');
  }
});

// Rota para adicionar um novo aluno
app.post('/alunos', async (req, res) => {
  try {
    const aluno = req.body;
    await dataService.addAluno(aluno);
    res.send('Aluno adicionado');
  } catch (err) {
    res.status(500).send('Erro ao adicionar aluno');
  }
});

// Rota para atualizar um aluno existente
app.put('/alunos/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const aluno = req.body;
    await dataService.updateAluno(id, aluno);
    res.send('Aluno atualizado');
  } catch (err) {
    res.status(500).send('Erro ao atualizar aluno');
  }
});

// Rota para remover um aluno
app.delete('/alunos/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await dataService.removeAluno(id);
    res.send('Aluno removido');
  } catch (err) {
    res.status(500).send('Erro ao remover aluno');
  }
});

// Rota para registrar a presença de um aluno
app.post('/registroPresenca', async (req, res) => {
  try {
    const { alunoId, data, presente } = req.body;
    await dataService.registerPresenca(alunoId, data, presente);
    res.send('Presença registrada');
  } catch (err) {
    res.status(500).send('Erro ao registrar presença');
  }
});

// Rota para buscar todas as presenças
app.get('/presencas', async (req, res) => {
  try {
    const result = await dataService.getFaltas();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar presenças' });
  }
});

// Rota para buscar faltas e presenças filtradas
app.get('/filterPresencas', async (req, res) => {
  try {
    const filters = req.query;
    const result = await dataService.getFilteredFaltas(filters);
    res.json(result);
  } catch (err) {
    res.status(500).send('Erro ao filtrar presenças');
  }
});

// Rota para buscar alunos filtrados
app.get('/filterAlunos', async (req, res) => {
  try {
    const filters = req.query;
    const alunos = await dataService.getFilteredAlunos(filters);
    res.json(alunos);
  } catch (err) {
    res.status(500).send('Erro ao filtrar alunos');
  }
});

// Rota para remover uma presença
app.delete('/presencas/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await dataService.removePresenca(id);
    res.send('Presença removida');
  } catch (err) {
    res.status(500).send('Erro ao remover presença');
  }
});

// Rota para atualizar a presença de um aluno
app.put('/presencas/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { presente } = req.body;
    await dataService.updatePresenca(id, presente);
    res.send('Presença atualizada');
  } catch (err) {
    res.status(500).send('Erro ao atualizar presença');
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
  console.log('Backend iniciado com sucesso!');
});
