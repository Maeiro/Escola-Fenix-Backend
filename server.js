//server.js

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

// Rota para buscar todos os alunos
app.get('/alunos', (req, res) => {
  dataService.getAllAlunos((err, alunos) => {
    if (err) {
      return res.status(500).send('Erro ao buscar alunos');
    }
    res.json(alunos);
  });
});

// Rota para adicionar um novo aluno
app.post('/alunos', (req, res) => {
  const aluno = req.body;
  dataService.addAluno(aluno, (err) => {
    if (err) {
      return res.status(500).send('Erro ao adicionar aluno');
    }
    res.send('Aluno adicionado');
  });
});

// Rota para atualizar um aluno existente
app.put('/alunos/:id', (req, res) => {
  const id = req.params.id;
  const aluno = req.body;
  dataService.updateAluno(id, aluno, (err) => {
    if (err) {
      return res.status(500).send('Erro ao atualizar aluno');
    }
    res.send('Aluno atualizado');
  });
});

// Rota para remover um aluno
app.delete('/alunos/:id', (req, res) => {
  const id = req.params.id;
  dataService.removeAluno(id, (err) => {
    if (err) {
      return res.status(500).send('Erro ao remover aluno');
    }
    res.send('Aluno removido');
  });
});

// Rota para registrar a presença de um aluno
app.post('/registroPresenca', (req, res) => {
  const { alunoId, data, presente } = req.body;
  dataService.registerPresenca(alunoId, data, presente, (err) => {
    if (err) {
      return res.status(500).send('Erro ao registrar presença');
    }
    res.send('Presença registrada');
  });
});

app.get('/presencas', (req, res) => {
  dataService.getFaltas((err, result) => {
    if (err) {
      res.status(500).json({ error: 'Erro ao buscar presenças' });
    } else {
      res.json(result);
    }
  });
});

// Rota para buscar faltas e presenças filtradas
app.get('/filterPresencas', (req, res) => {
  const filters = req.query;
  dataService.getFilteredFaltas(filters, (err, result) => {
    if (err) {
      return res.status(500).send('Erro ao filtrar presenças');
    }
    res.json(result);
  });
});

app.get('/filterAlunos', (req, res) => {
  const filters = req.query;
  dataService.getFilterAlunos(filters, (err, alunos) => {
    if (err) {
      return res.status(500).send('Erro ao filtrar alunos');
    }
    res.json(alunos);
  });
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
  console.log('Backend iniciado com sucesso!');
});
