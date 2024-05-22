// server.js

const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3002;
const dataService = require('./dataService.js');

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Backend funcionando!');
});

app.get('/alunos', async (req, res) => {
  try {
    const alunos = await dataService.getAllAlunos();
    res.json(alunos);
  } catch (err) {
    res.status(500).send('Erro ao buscar alunos');
  }
});

app.post('/alunos', async (req, res) => {
  try {
    const aluno = req.body;
    await dataService.addAluno(aluno);
    res.send('Aluno adicionado');
  } catch (err) {
    res.status(500).send('Erro ao adicionar aluno');
  }
});

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

app.delete('/alunos/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await dataService.removeAluno(id);
    res.send('Aluno removido');
  } catch (err) {
    res.status(500).send('Erro ao remover aluno');
  }
});

app.post('/registroPresenca', async (req, res) => {
  try {
    const { alunoId, data, presente } = req.body;
    await dataService.registerPresenca(alunoId, data, presente);
    res.send('Presença registrada');
  } catch (err) {
    res.status(500).send('Erro ao registrar presença');
  }
});

app.get('/presencas', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const result = await dataService.getPresencas(page, limit);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar presenças' });
  }
});

app.get('/filterPresencas', async (req, res) => {
  try {
    const filters = req.query;
    const result = await dataService.getFilteredFaltas(filters);
    res.json(result);
  } catch (err) {
    res.status(500).send('Erro ao filtrar presenças');
  }
});

app.get('/filterAlunos', async (req, res) => {
  try {
    const filters = req.query;
    const alunos = await dataService.getFilteredAlunos(filters);
    res.json(alunos);
  } catch (err) {
    console.error('Erro ao filtrar alunos', err);
    res.status(500).send('Erro ao filtrar alunos');
  }
});

app.delete('/presencas/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await dataService.removePresenca(id);
    res.send('Presença removida');
  } catch (err) {
    res.status(500).send('Erro ao remover presença');
  }
});

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

module.exports = app;