// __tests__/server.test.js

const request = require('supertest');
const app = require('../server');
const dataService = require('../dataService');

jest.mock('../dataService');

describe('Server API Endpoints', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should respond to the root route', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toEqual(200);
    expect(res.text).toEqual('Backend funcionando!');
  });

  describe('GET /alunos', () => {
    it('should fetch all students', async () => {
      const mockAlunos = [{ id: 1, nome: 'John Doe', turma: 'A', total_faltas: 0 }];
      dataService.getAllAlunos.mockResolvedValue(mockAlunos);

      const res = await request(app).get('/alunos');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockAlunos);
    });

    it('should handle errors', async () => {
      dataService.getAllAlunos.mockRejectedValue(new Error('Erro ao buscar alunos'));

      const res = await request(app).get('/alunos');
      expect(res.statusCode).toEqual(500);
      expect(res.text).toEqual('Erro ao buscar alunos');
    });
  });

  describe('POST /alunos', () => {
    it('should add a new student', async () => {
      const newAluno = { nome: 'John Doe', turma: 'A', total_faltas: 0 };

      const res = await request(app).post('/alunos').send(newAluno);
      expect(res.statusCode).toEqual(200);
      expect(res.text).toEqual('Aluno adicionado');
      expect(dataService.addAluno).toHaveBeenCalledWith(newAluno);
    });

    it('should handle errors', async () => {
      dataService.addAluno.mockRejectedValue(new Error('Erro ao adicionar aluno'));

      const res = await request(app).post('/alunos').send({ nome: 'John Doe', turma: 'A', total_faltas: 0 });
      expect(res.statusCode).toEqual(500);
      expect(res.text).toEqual('Erro ao adicionar aluno');
    });
  });

  describe('PUT /alunos/:id', () => {
    it('should update a student', async () => {
      const updatedAluno = { nome: 'John Doe', turma: 'B', total_faltas: 1 };

      const res = await request(app).put('/alunos/1').send(updatedAluno);
      expect(res.statusCode).toEqual(200);
      expect(res.text).toEqual('Aluno atualizado');
      expect(dataService.updateAluno).toHaveBeenCalledWith('1', updatedAluno);
    });

    it('should handle errors', async () => {
      dataService.updateAluno.mockRejectedValue(new Error('Erro ao atualizar aluno'));

      const res = await request(app).put('/alunos/1').send({ nome: 'John Doe', turma: 'B', total_faltas: 1 });
      expect(res.statusCode).toEqual(500);
      expect(res.text).toEqual('Erro ao atualizar aluno');
    });
  });

  describe('DELETE /alunos/:id', () => {
    it('should delete a student', async () => {
      const res = await request(app).delete('/alunos/1');
      expect(res.statusCode).toEqual(200);
      expect(res.text).toEqual('Aluno removido');
      expect(dataService.removeAluno).toHaveBeenCalledWith('1');
    });

    it('should handle errors', async () => {
      dataService.removeAluno.mockRejectedValue(new Error('Erro ao remover aluno'));

      const res = await request(app).delete('/alunos/1');
      expect(res.statusCode).toEqual(500);
      expect(res.text).toEqual('Erro ao remover aluno');
    });
  });

  describe('POST /registroPresenca', () => {
    it('should register a presence', async () => {
      const presence = { alunoId: 1, data: '2022-05-01', presente: true };

      const res = await request(app).post('/registroPresenca').send(presence);
      expect(res.statusCode).toEqual(200);
      expect(res.text).toEqual('Presença registrada');
      expect(dataService.registerPresenca).toHaveBeenCalledWith(presence.alunoId, presence.data, presence.presente);
    });

    it('should handle errors', async () => {
      dataService.registerPresenca.mockRejectedValue(new Error('Erro ao registrar presença'));

      const res = await request(app).post('/registroPresenca').send({ alunoId: 1, data: '2022-05-01', presente: true });
      expect(res.statusCode).toEqual(500);
      expect(res.text).toEqual('Erro ao registrar presença');
    });
  });

  describe('GET /presencas', () => {
    it('should fetch all presences', async () => {
      const mockPresencas = [{ id: 1, aluno_id: 1, data: '2022-05-01', presente: false, aluno_nome: 'John Doe', turma: 'A', total_faltas: 1 }];
      dataService.getFaltas.mockResolvedValue(mockPresencas);

      const res = await request(app).get('/presencas');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockPresencas);
    });

    it('should handle errors', async () => {
      dataService.getFaltas.mockRejectedValue(new Error('Erro ao buscar presenças'));

      const res = await request(app).get('/presencas');
      expect(res.statusCode).toEqual(500);
      expect(res.body).toEqual({ error: 'Erro ao buscar presenças' });
    });
  });

  describe('GET /filterPresencas', () => {
    it('should fetch filtered presences', async () => {
      const filters = { presente: 'false' };
      const mockPresencas = [{ id: 1, aluno_id: 1, data: '2022-05-01', presente: false, aluno_nome: 'John Doe', turma: 'A', total_faltas: 1 }];
      dataService.getFilteredFaltas.mockResolvedValue(mockPresencas);

      const res = await request(app).get('/filterPresencas').query(filters);
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockPresencas);
    });

    it('should handle errors', async () => {
      dataService.getFilteredFaltas.mockRejectedValue(new Error('Erro ao filtrar presenças'));

      const res = await request(app).get('/filterPresencas').query({ presente: 'false' });
      expect(res.statusCode).toEqual(500);
      expect(res.text).toEqual('Erro ao filtrar presenças');
    });
  });

  describe('GET /filterAlunos', () => {
    it('should fetch filtered students', async () => {
      const filters = { nome: 'John' };
      const mockAlunos = [{ id: 1, nome: 'John Doe', turma: 'A', total_faltas: 0 }];
      dataService.getFilteredAlunos.mockResolvedValue(mockAlunos);

      const res = await request(app).get('/filterAlunos').query(filters);
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockAlunos);
    });

    it('should handle errors', async () => {
      dataService.getFilteredAlunos.mockRejectedValue(new Error('Erro ao filtrar alunos'));

      const res = await request(app).get('/filterAlunos').query({ nome: 'John' });
      expect(res.statusCode).toEqual(500);
      expect(res.text).toEqual('Erro ao filtrar alunos');
    });
  });

  describe('DELETE /presencas/:id', () => {
    it('should delete a presence', async () => {
      const res = await request(app).delete('/presencas/1');
      expect(res.statusCode).toEqual(200);
      expect(res.text).toEqual('Presença removida');
      expect(dataService.removePresenca).toHaveBeenCalledWith('1');
    });

    it('should handle errors', async () => {
      dataService.removePresenca.mockRejectedValue(new Error('Erro ao remover presença'));

      const res = await request(app).delete('/presencas/1');
      expect(res.statusCode).toEqual(500);
      expect(res.text).toEqual('Erro ao remover presença');
    });
  });

  describe('PUT /presencas/:id', () => {
    it('should update a presence', async () => {
      const updateData = { presente: true };

      const res = await request(app).put('/presencas/1').send(updateData);
      expect(res.statusCode).toEqual(200);
      expect(res.text).toEqual('Presença atualizada');
      expect(dataService.updatePresenca).toHaveBeenCalledWith('1', updateData.presente);
    });

    it('should handle errors', async () => {
      dataService.updatePresenca.mockRejectedValue(new Error('Erro ao atualizar presença'));

      const res = await request(app).put('/presencas/1').send({ presente: true });
      expect(res.statusCode).toEqual(500);
      expect(res.text).toEqual('Erro ao atualizar presença');
    });
  });
});
