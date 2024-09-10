import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import session from 'express-session';
import pkg from 'pg';

const { Pool } = pkg;

dotenv.config(); // Carrega as variáveis de ambiente

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não está definido.");
  process.exit(1); // Finaliza o processo com erro
}

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware para interpretar JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar middleware de sessão
app.use(session({
  secret: process.env.SESSION_SECRET || 'seuSegredo',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: false, // Defina como false para desenvolvimento local
    maxAge: 8 * 60 * 60 * 1000, // 8 horas
  }
}));



// Função para inicializar a conexão com o banco de dados
async function initializeDatabase() {
  try {
    console.log("Database URL:", process.env.DATABASE_URL);
    app.use(express.static(path.join(__dirname, 'public')));

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // SSL para o Neon
      }
    });

    // Testar a conexão
    const client = await pool.connect();
    console.log("Connected to PostgreSQL database");
    client.release();

    // Definir a conexão globalmente
    global.connection = pool;

  } catch (error) {
    console.error("Failed to connect to PostgreSQL database:", error);
    throw error;
  }
}
// Iniciar o servidor após a conexão com o banco de dados ser estabelecida
initializeDatabase().then(() => {
  app.listen(process.env.PORT || 5000, () => {
    console.log('Server is running');
  });
});

// Middleware para verificar se o usuário está autenticado
function Autenticado(req, res, next) {
  if (req.session.user) {
    console.log('Usuário autenticado:', req.session.user);
    return next();
  } else {
    console.log('Usuário não autenticado, redirecionando para a página inicial');
    res.redirect('/');
  }
}

    // Rotas protegidas
    function authenticate(req, res, next) {
      if (req.session && req.session.userId) {
          next();
      } else {
          res.status(401).send('Não autorizado');
      }
  }
    // Rota protegida
    app.get('/protected-route', authenticate, (req, res) => {
      res.send('Conteúdo protegido');
  });

  
// Rota de login
app.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }

    if (!global.connection) {
      return res.status(500).json({ error: 'Erro na conexão com o banco de dados' });
    }

    const result = await global.connection.query('SELECT * FROM usuario WHERE email = $1', [email]);

    if (result.rows.length === 0 || senha !== result.rows[0].senha) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    req.session.user = {
      nome: result.rows[0].nome_usuario,
      email: result.rows[0].email,
      tipo_usuario: result.rows[0].tipo_usuario
    };

    console.log(`Login bem-sucedido para o usuário: ${email}`);
    console.log('Diretório atual:', __dirname);
    console.log('Caminho absoluto para public:', path.join(__dirname, 'public'));
    console.log('Sessão após login:', req.session.user);
    
    res.json({ success: true });

  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.get('/api/usuario-logado', (req, res) => {
   
  if (req.session.user) {
    res.json({
      id_usuario: req.session.user.id_usuario,
      nome: req.session.user.nome,
      tipo_usuario: req.session.user.tipo_usuario
    });
  } else {
    res.status(401).json({ error: 'Usuário não logado' });
  }
});


app.get('/Relatorio', Autenticado, (req, res) => {
  const filePath = path.join(__dirname, 'public', 'relatorio.html');
  console.log('Caminho absoluto para Relatorio.html:', filePath); // Verifica o caminho
  res.sendFile(filePath);
});



  app.get('/Usuarios', Autenticado, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Usuarios.html'));
  });

  app.get('/Produtos', Autenticado, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Produtos.html'));
  });

  app.get('/Laboratorio', Autenticado, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Laboratorio.html'));
  });



  app.get('/logout', (req, res) => {
    req.session.destroy(err => {
      if (err) {
        console.error('Erro ao destruir a sessão:', err);
        return res.status(500).json({ error: 'Erro ao fazer logout' });
      }
      res.clearCookie('connect.sid');
      res.redirect('/');
    });
  });

  // Middleware para desativar cache
  function disableCache(req, res, next) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  }

  app.use('/protected/*', disableCache);

  // Rotas para usuários
  app.get('/api/usuarios', Autenticado, async (req, res) => {
    try {
      const result = await connection.query('SELECT nome_usuario, email FROM usuario');
      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro no servidor' });
    }
  });

  app.post('/api/usuarios', Autenticado, async (req, res) => {
    const { nome_usuario, email, senha, tipo_usuario } = req.body;
  
    if (!nome_usuario || !email || !senha || !tipo_usuario) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }
  
    try {
      // Verificar se o nome de usuário já existe
      const resultByName = await connection.query(
        'SELECT id_usuario FROM usuario WHERE nome_usuario = $1',
        [nome_usuario]
      );
  
      if (resultByName.rows.length > 0) {
        return res.status(400).json({ error: 'Nome de usuário já está em uso' });
      }
  
      // Verificar se o email já existe
      const resultByEmail = await connection.query(
        'SELECT id_usuario FROM usuario WHERE email = $1',
        [email]
      );
  
      if (resultByEmail.rows.length > 0) {
        return res.status(400).json({ error: 'Email já está em uso' });
      }
  
      // Inserir o novo usuário
      await connection.query(
        'INSERT INTO usuario (nome_usuario, email, senha, tipo_usuario) VALUES ($1, $2, $3, $4)',
        [nome_usuario, email, senha, tipo_usuario]
      );
  
      res.status(201).json({ message: 'Usuário adicionado com sucesso' });
    } catch (error) {
      console.error('Erro ao adicionar usuário:', error);
      res.status(500).json({ error: 'Erro no servidor' });
    }
  });

  // Rotas para usuários
  app.get('/api/usuarios', Autenticado, async (req, res) => {
    try {
      const [usuarios] = await connection.execute('SELECT nome_usuario, email FROM usuario');
      res.json(usuarios);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro no servidor' });
    }
  });

  app.post('/api/usuarios', Autenticado, async (req, res) => {
    const { nome_usuario, email, senha, tipo_usuario } = req.body;
  
    if (!nome_usuario || !email || !senha || !tipo_usuario) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }
  
    try {
      // Verificar se o nome de usuário já existe
      const [existingUserByName] = await connection.execute(
        'SELECT id_usuario FROM usuario WHERE nome_usuario = ?',
        [nome_usuario]
      );
  
      if (existingUserByName.length > 0) {
        return res.status(400).json({ error: 'Nome de usuário já está em uso' });
      }
  
      // Verificar se o email já existe
      const [existingUserByEmail] = await connection.execute(
        'SELECT id_usuario FROM usuario WHERE email = ?',
        [email]
      );
  
      if (existingUserByEmail.length > 0) {
        return res.status(400).json({ error: 'Email já está em uso' });
      }
  
      // Inserir o novo usuário
      await connection.execute(
        'INSERT INTO usuario (nome_usuario, email, senha, tipo_usuario) VALUES (?, ?, ?, ?)',
        [nome_usuario, email, senha, tipo_usuario]
      );
  
      res.status(201).json({ message: 'Usuário adicionado com sucesso' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro no servidor' });
    }
  });
  

  app.delete('/api/usuarios/:email', Autenticado, async (req, res) => {
    const { email } = req.params;

    try {
      await connection.execute(
        'DELETE FROM usuario WHERE email = ?',
        [email]
      );
      res.status(200).json({ message: 'Usuário removido com sucesso' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro no servidor' });
    }
  });

/* --------------Checkar usuario------------------*/

app.get('/api/check-auth', (req, res) => {
  if (req.session.user) {
    console.log('Usuário autenticado:', req.session.user);
    res.json({ Autenticado: true });
  } else {
    console.log('Nenhum usuário autenticado.');
    res.json({ Autenticado: false });
  }
});



  /* --------------produtos------------------*/

  // Rotas para produtos
  app.get('/api/produtos', Autenticado, async (req, res) => {
    try {
      const [produtos] = await connection.execute('SELECT DISTINCT nome_produto FROM estoque');
      res.json(produtos.map(produto => ({ nome_produto: produto.nome_produto })));
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
  });
  
  /* --------------laboratórios------------------*/

 // obter todos os laboratórios
app.get('/api/laboratorios', Autenticado, async (req, res) => {
  try {
      //consulta para obter todos os laboratórios e seus responsáveis
      const [laboratorios] = await connection.execute(`
          SELECT laboratorio.id_laboratorio, laboratorio.nome_laboratorio, usuario.nome_usuario AS responsavel, usuario.email
          FROM laboratorio
          LEFT JOIN usuario ON laboratorio.usuario_email = usuario.email
      `);
      res.json(laboratorios);
  } catch (error) {
      console.error('Erro ao obter laboratórios:', error);
      res.status(500).json({ error: 'Erro no servidor ao obter laboratórios' });
  }
});


app.get('/api/laboratoriosPag', async (req, res) => {
  const { page = 1 } = req.query; 
  const limit = 20; 
  const pageInt = parseInt(page, 10);

  if (isNaN(pageInt)) {
    return res.status(400).json({ error: 'The page parameter must be an integer.' });
  }

  const offset = (pageInt - 1) * limit;

  try {
    const [rows] = await connection.query(`
      SELECT l.id_laboratorio, l.nome_laboratorio, u.email AS usuario_email, u.nome_usuario
      FROM laboratorio l
      JOIN usuario u ON l.usuario_email = u.email
      LIMIT ${limit} OFFSET ${offset}
    `);

    const [countResult] = await connection.query('SELECT COUNT(*) as total FROM laboratorio');
    const totalItems = countResult[0].total;
    const totalPages = Math.ceil(totalItems / limit);

    res.json({
      data: rows,
      totalItems,
      totalPages,
      currentPage: pageInt,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});


// Adicionar um laboratório
app.post('/api/laboratorios', async (req, res) => {
  try {
    const { nome_laboratorio, usuario_email } = req.body;

    if (!nome_laboratorio || !usuario_email) {
      return res.status(400).json({ error: 'Nome do laboratório e email do usuário são obrigatórios.' });
    }

    const [existingLab] = await connection.execute(
      'SELECT * FROM laboratorio WHERE nome_laboratorio = ?',
      [nome_laboratorio]
    );

    if (existingLab.length > 0) {
      return res.status(400).json({ error: 'Nome do laboratório já em uso.' });
    }

    // Inserir novo laboratório
    const [result] = await connection.execute(
      'INSERT INTO laboratorio (nome_laboratorio, usuario_email) VALUES (?, ?)',
      [nome_laboratorio, usuario_email]
    );

    res.status(201).json({ message: 'Laboratório adicionado com sucesso!', id_laboratorio: result.insertId });
  } catch (error) {
    console.error('Erro ao adicionar laboratório:', error);
    res.status(500).json({ error: 'Erro ao adicionar laboratório.' });
  }
});

//remover um laboratório
app.delete('/api/laboratorios/:id_laboratorio', Autenticado, async (req, res) => {
  try {
      const { id_laboratorio } = req.params;
      console.log('ID do Laboratório recebido:', id_laboratorio);

      // Verifica se o laboratório existe
      const [laboratorioCheck] = await connection.execute('SELECT id_laboratorio FROM laboratorio WHERE id_laboratorio = ?', [id_laboratorio]);
      if (laboratorioCheck.length === 0) {
          return res.status(404).json({ error: 'Laboratório não encontrado.' });
      }

      // Remove o laboratório
      await connection.execute('DELETE FROM laboratorio WHERE id_laboratorio = ?', [id_laboratorio]);
      res.json({ message: 'Laboratório removido com sucesso!' });
  } catch (error) {
      console.error('Erro ao remover laboratório:', error);
      res.status(500).json({ error: 'Erro ao remover laboratório' });
  }
});


app.get('/api/lab', Autenticado, async (req, res) => {
  try {
      const [labs] = await connection.execute('SELECT id_laboratorio, nome_laboratorio FROM laboratorio');
      res.json(labs);
  } catch (error) {
      console.error('Erro ao buscar laboratórios:', error);
      res.status(500).json({ message: 'Erro ao buscar laboratórios' });
  }
});


  /* --------------estoque------------------*/

  app.post('/api/addestoque', async (req, res) => {
    try {
      const { sigla, concentracao, densidade, nome_produto, tipo_unidade_produto, ncm, quantidade } = req.body;
  
      // Primeiro, verifica se já existe um registro com a mesma sigla
      const [existing] = await connection.execute(
        'SELECT * FROM estoque WHERE sigla = ?',
        [sigla]
      );
  
      if (existing.length > 0) {
        // Se a sigla já existir, retorna uma mensagem de erro
        return res.status(400).json({ error: 'Sigla já usada.' });
      }
  
      // Se a sigla não existir, prossegue com a inserção
      const [result] = await connection.execute(
        'INSERT INTO estoque (sigla, concentracao, densidade, nome_produto, tipo_unidade_produto, ncm, quantidade) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [sigla, concentracao, densidade, nome_produto, tipo_unidade_produto, ncm, quantidade]
      );
  
      res.status(201).json({ message: 'Estoque adicionado com sucesso!', id_estoque: result.insertId });
    } catch (error) {
      console.error('Erro ao adicionar estoque:', error);
      res.status(500).json({ error: 'Erro ao adicionar estoque.' });
    }
  });
  

app.get('/api/est', Autenticado, async (req, res) => {
  try {
      const [labs] = await connection.execute('SELECT id_estoque, sigla FROM estoque');
      res.json(labs);
  } catch (error) {
      console.error('Erro ao buscar estoque:', error);
      res.status(500).json({ message: 'Erro ao buscar estoque' });
  }
});

app.get('/api/estoque', Autenticado, async (req, res) => {
  try {
    const [rows] = await connection.execute(`
      SELECT 
        nome_produto, 
        quantidade, 
        tipo_unidade_produto,
        sigla,
        densidade,
        ncm,
        concentracao
      FROM estoque
      ORDER BY nome_produto;
    `);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao carregar inventário:', error);
    res.status(500).json({ error: 'Erro ao carregar inventário.' });
  }
});

app.get('/api/estoque/:sigla', Autenticado, async (req, res) => {
  const sigla = req.params.sigla;
  console.log('sigla received:', sigla); 
  try {
      const [rows] = await connection.execute(
          `SELECT * FROM estoque WHERE sigla = ?`, [sigla]
      );
      res.json(rows);
  } catch (error) {
      console.error('Erro ao carregar estoque:', error);
      res.status(500).json({ error: 'Erro ao carregar estoque' });
  }
});


/* --------------Gerador de PDF------------------*/
app.get('/generate-pdf-estoque', async (req, res) => {
    try {
        const [estoque] = await connection.execute(
            'SELECT nome_produto, concentracao, densidade, quantidade, tipo_unidade_produto, ncm FROM estoque ORDER BY nome_produto ASC'
        );

        const doc = new PDFDocument({ margin: 50 });
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0]; // data como YYYY-MM-DD
        const formattedTime = today.toTimeString().split(' ')[0]; // hora como HH:MM:SS
        const fileName = `Relatorio_Estoque.pdf`;

        // Tipo de conteúdo e o nome do download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        doc.pipe(res); // Enviar o PDF

        // Adicionar imagem
        const logoPath = path.join(__dirname, '../src/public/images/logoRelatorio.jpg');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, 45, { width: 150 });
        }

        // Texto do relatório
        doc.fontSize(16).text('Relatório de Estoque', 200, 50, { align: 'center' });
        doc.moveDown();
        
        // Data e hora
        doc.fontSize(12).text(`Data: ${formattedDate}`, { align: 'center' });
        doc.text(`Hora: ${formattedTime}`, { align: 'center' });
        doc.moveDown();

        // Cabeçalhos da tabela
        const tableTop = 150;
        const itemHeight = 20;
        const columnWidths = [130, 80, 80, 80, 90, 100]; // Largura das colunas
        const pageHeight = doc.page.height - 50; // Altura da página menos margens
        let yPosition = tableTop;

        // Função para desenhar os cabeçalhos
        const drawTableHeaders = () => {
            doc.fontSize(10).text('Nome do Produto', 50, yPosition);
            doc.text('Concentração', 50 + columnWidths[0], yPosition);
            doc.text('Densidade', 50 + columnWidths[0] + columnWidths[1], yPosition);
            doc.text('Quantidade', 50 + columnWidths[0] + columnWidths[1] + columnWidths[2], yPosition);
            doc.text('Tipo de Unidade', 50 + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3], yPosition);
            doc.text('NCM', 50 + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3] + columnWidths[4], yPosition);
            yPosition += itemHeight;
        };

        // Função para desenhar uma linha da tabela
        const drawTableRow = (item) => {
            if (yPosition + itemHeight > pageHeight) {
                doc.addPage();
                yPosition = 50; // Reposiciona o Y para o topo da nova página
                drawTableHeaders(); // Redesenha os cabeçalhos na nova página
            }

            doc.text(item.nome_produto, 50, yPosition, { width: columnWidths[0] });
            doc.text(item.concentracao, 50 + columnWidths[0], yPosition, { width: columnWidths[1] });
            doc.text(item.densidade, 50 + columnWidths[0] + columnWidths[1], yPosition, { width: columnWidths[2] });
            doc.text(item.quantidade, 50 + columnWidths[0] + columnWidths[1] + columnWidths[2], yPosition, { width: columnWidths[3] });
            doc.text(item.tipo_unidade_produto, 50 + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3], yPosition, { width: columnWidths[4] });
            doc.text(item.ncm, 50 + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3] + columnWidths[4], yPosition, { width: columnWidths[5] });
            yPosition += itemHeight;
        };

        // Desenhar cabeçalhos
        drawTableHeaders();

        // Desenhar linhas
        estoque.forEach(item => {
            drawTableRow(item);
        });

        doc.end(); // Finalizar o PDF

    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        res.status(500).json({ error: 'Erro ao gerar PDF' });
    }
});



app.get('/generate-pdf-entradatipo2', async (req, res) => {
    const { start_date, end_date } = req.query;
    let sqlQuery = `
      SELECT 
          re.id_entrada, 
          re.data_entrada, 
          e.nome_produto, 
          re.quantidade 
      FROM 
          registro_entrada re
      JOIN 
          estoque e ON re.id_estoque = e.id_estoque
    `;

    const queryParams = [];
    if (start_date && end_date) {
        sqlQuery += ' WHERE re.data_entrada BETWEEN ? AND ?';
        queryParams.push(start_date, end_date);
    }

    sqlQuery += ' ORDER BY re.data_entrada DESC';

    try {
        const [registraEntrada] = await connection.execute(sqlQuery, queryParams);

        const doc = new PDFDocument({ margin: 50 });
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];
        const formattedTime = today.toTimeString().split(' ')[0];
        const fileName = `Relatorio_Entrada.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        doc.pipe(res);

        // Adiciona logo
        const logoPath = path.join(__dirname, '../src/public/images/logoRelatorio.jpg');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, 45, { width: 100 });
        }

        // Título
        doc.fontSize(16).text('Relatório de Entrada', 200, 50, { align: 'center' });
        doc.fontSize(12).text(`Data: ${formattedDate.split('-').reverse().join('/')}`, { align: 'center' });
        doc.text(`Hora: ${formattedTime}`, { align: 'center' });
        doc.moveDown(2);

        // Configuração da tabela
        const tableTop = 150;
        const itemHeight = 20;
        const columnWidths = [80, 100, 200, 100];
        const pageHeight = doc.page.height - 50; // Altura da página menos margens
        let yPosition = tableTop;

        // Função para desenhar os cabeçalhos da tabela
        const drawTableHeaders = () => {
            doc.fontSize(10).text('ID Entrada', 50, yPosition);
            doc.text('Data Entrada', 50 + columnWidths[0], yPosition);
            doc.text('Nome Produto', 50 + columnWidths[0] + columnWidths[1], yPosition);
            doc.text('Quantidade', 50 + columnWidths[0] + columnWidths[1] + columnWidths[2], yPosition);
            yPosition += itemHeight;
        };

        // Função para desenhar uma linha da tabela
        const drawTableRow = (item) => {
            if (yPosition + itemHeight > pageHeight) {
                doc.addPage();
                yPosition = 50; // Reposiciona o Y para o topo da nova página
                drawTableHeaders(); // Redesenha os cabeçalhos da tabela na nova página
            }

            doc.text(item.id_entrada, 50, yPosition, { width: columnWidths[0] });

            const formattedDataEntrada = new Date(item.data_entrada).toLocaleDateString('pt-BR');
            doc.text(formattedDataEntrada, 50 + columnWidths[0], yPosition, { width: columnWidths[1] });

            doc.text(item.nome_produto, 50 + columnWidths[0] + columnWidths[1], yPosition, { width: columnWidths[2] });
            doc.text(item.quantidade, 50 + columnWidths[0] + columnWidths[1] + columnWidths[2], yPosition, { width: columnWidths[3] });

            yPosition += itemHeight;
        };

        // Desenha os cabeçalhos inicialmente
        drawTableHeaders();

        // Desenha as linhas
        registraEntrada.forEach(item => {
            drawTableRow(item);
        });

        doc.end();
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        res.status(500).json({ error: 'Erro ao gerar PDF' });
    }
});


app.get('/generate-pdf-consumo', async (req, res) => {
  try {
      const { start_date, end_date, laboratorio } = req.query;

      console.log('Parâmetros recebidos:', { start_date, end_date, laboratorio }); // Adicione este log

      // Base da consulta SQL
      let sqlQuery = `
          SELECT 
              rc.id_consumo, 
              rc.data_consumo, 
              e.sigla, 
              e.nome_produto, 
              l.nome_laboratorio, 
              rc.quantidade, 
              e.tipo_unidade_produto, 
              rc.descricao 
          FROM 
              registro_consumo rc 
          JOIN 
              estoque e 
          ON 
              rc.id_estoque = e.id_estoque 
          JOIN 
              laboratorio l 
          ON 
              rc.id_laboratorio = l.id_laboratorio
      `;
      
      // Parâmetros da consulta SQL
      const queryParams = [];

      // Adiciona filtro de data se ambos start_date e end_date forem fornecidos
      if (start_date && end_date) {
          sqlQuery += ' WHERE rc.data_consumo BETWEEN ? AND ?';
          queryParams.push(start_date, end_date);
      }

      // Adiciona filtro de laboratório se um laboratório específico for fornecido
      if (laboratorio && laboratorio !== 'todos') {
          if (queryParams.length) {
              sqlQuery += ' AND rc.id_laboratorio = ?';
          } else {
              sqlQuery += ' WHERE rc.id_laboratorio = ?';
          }
          queryParams.push(laboratorio);
      }

      sqlQuery += ' ORDER BY rc.data_consumo DESC';

      console.log('Consulta SQL:', sqlQuery);
      console.log('Parâmetros da consulta:', queryParams);

      // Executa a consulta
      const [registroConsumo] = await connection.execute(sqlQuery, queryParams);
      console.log('Dados retornados:', registroConsumo);

      if (registroConsumo.length === 0) {
          console.log('Nenhum dado encontrado.');
          return res.status(404).json({ message: 'Nenhum dado encontrado' });
      }

      const doc = new PDFDocument({ margin: 50 });
      const today = new Date();
      const formattedDate = today.toLocaleDateString('pt-BR');
      const formattedTime = today.toLocaleTimeString('pt-BR');
      const fileName = `Relatorio_Consumo.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      doc.pipe(res);

      // Adiciona logo
      const logoPath = path.join(__dirname, '../src/public/images/logoRelatorio.jpg');
      if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 50, 45, { width: 100 });
      }

      // Título
      doc.fontSize(16).text('Relatório de Consumo', { align: 'center' });
      doc.fontSize(12).text(`Data: ${formattedDate}`, { align: 'center' });
      doc.text(`Hora: ${formattedTime}`, { align: 'center' });
      doc.moveDown(2);

      // Configuração da tabela
      const tableTop = 150;
      const itemHeight = 20;
      const columnWidths = [70, 90, 70, 110, 50, 70, 70];
      const pageHeight = doc.page.height - 50;
      let yPosition = tableTop;

      // Função para desenhar os cabeçalhos da tabela
      const drawTableHeaders = () => {
          doc.fontSize(8).text('Data Consumo', 50, yPosition);
          doc.text('Sigla', 50 + columnWidths[0], yPosition);
          doc.text('Produto', 50 + columnWidths[0] + columnWidths[1], yPosition);
          doc.text('Laboratório', 50 + columnWidths[0] + columnWidths[1] + columnWidths[2], yPosition);
          doc.text('Quantidade', 50 + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3], yPosition);
          doc.text('Tipo de Unidade', 50 + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3] + columnWidths[4], yPosition);
          doc.text('Descrição', 50 + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3] + columnWidths[4] + columnWidths[5], yPosition);
          yPosition += itemHeight;
      };

      // Função para desenhar uma linha da tabela
      const drawTableRow = (item) => {
          if (yPosition + itemHeight > pageHeight) {
              doc.addPage();
              yPosition = 50;
              drawTableHeaders();
          }

          const formattedDataConsumo = new Date(item.data_consumo).toLocaleDateString('pt-BR');
          doc.text(formattedDataConsumo, 50, yPosition, { width: columnWidths[0] });
          doc.text(item.sigla, 50 + columnWidths[0], yPosition, { width: columnWidths[1] });
          doc.text(item.nome_produto, 50 + columnWidths[0] + columnWidths[1], yPosition, { width: columnWidths[2] });
          doc.text(item.nome_laboratorio, 50 + columnWidths[0] + columnWidths[1] + columnWidths[2], yPosition, { width: columnWidths[3] });
          doc.text(item.quantidade, 50 + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3], yPosition, { width: columnWidths[4] });
          doc.text(item.tipo_unidade_produto, 50 + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3] + columnWidths[4], yPosition, { width: columnWidths[5] });
          doc.text(item.descricao, 50 + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3] + columnWidths[4] + columnWidths[5], yPosition, { width: columnWidths[6] });

          yPosition += itemHeight;
      };

      drawTableHeaders();
      registroConsumo.forEach(item => drawTableRow(item));

      doc.end();
  } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      res.status(500).json({ error: 'Erro ao gerar PDF' });
  }
});


  /* --------------registrar_consumo------------------*/

  app.post('/api/registrar_consumo', Autenticado, async (req, res) => {  
    try {
        const { data_consumo, id_estoque, id_laboratorio, quantidade, descricao } = req.body;
  
        if (!data_consumo || !id_estoque || !id_laboratorio || !quantidade || !descricao) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
        }
  
        // Verifica a quantidade atual no estoque
        const [estoqueResult] = await connection.execute(
            'SELECT quantidade FROM estoque WHERE id_estoque = ?',
            [id_estoque]
        );
  
        if (estoqueResult.length === 0) {
            return res.status(404).json({ error: 'Estoque não encontrado.' });
        }
  
        const quantidadeEstoque = estoqueResult[0].quantidade;
  
        // Verifica se a quantidade 
        if (quantidade > quantidadeEstoque) {
            return res.status(400).json({ error: 'Quantidade solicitada excede a quantidade disponível no estoque.' });
        }
  
        // Calcula a nova quantidade
        const novaQuantidadeEstoque = quantidadeEstoque - quantidade;
  
        // Inicia uma transação
        await connection.beginTransaction();
  
        // Atualiza a quantidade 
        await connection.execute(
            'UPDATE estoque SET quantidade = ? WHERE id_estoque = ?',
            [novaQuantidadeEstoque, id_estoque]
        );
  
        // Adiciona o novo registro 
        const [result] = await connection.execute(
            'INSERT INTO registro_consumo (data_consumo, id_estoque, id_laboratorio, quantidade, descricao) VALUES (?, ?, ?, ?, ?)',
            [data_consumo, id_estoque, id_laboratorio, quantidade, descricao]
        );
  
        // Confirma a transação
        await connection.commit();
  
        res.status(201).json({ message: 'Consumo registrado com sucesso!', id_consumo: result.insertId });
  
    } catch (error) {
        // Em caso de erro, desfaz
        if (connection) await connection.rollback();
        console.error('Erro ao registrar consumo:', error);
        res.status(500).json({ error: 'Erro ao registrar consumo.' });
    }
  });
  

  app.post('/api/registrar_entrada', Autenticado, async (req, res) => {
    try {
        const { id_estoque, quantidade, data_entrada, descricao } = req.body;

        // Verifica se os campos
        if (!id_estoque || !quantidade || !data_entrada) {
            return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
        }

        // Inicia uma transação
        await connection.beginTransaction();

        // Adiciona o novo registro
        const [result] = await connection.execute(
            'INSERT INTO registro_entrada (data_entrada, id_estoque, quantidade, descricao) VALUES (?, ?, ?, ?)',
            [data_entrada, id_estoque, quantidade, descricao || '']
        );

        // Atualiza a quantidade
        const [estoqueResult] = await connection.execute(
            'SELECT quantidade FROM estoque WHERE id_estoque = ?',
            [id_estoque]
        );

        const quantidadeEstoque = estoqueResult[0].quantidade;
        const novaQuantidadeEstoque = quantidadeEstoque + quantidade;

        await connection.execute(
            'UPDATE estoque SET quantidade = ? WHERE id_estoque = ?',
            [novaQuantidadeEstoque, id_estoque]
        );

        // Confirma a transação
        await connection.commit();

        res.status(201).json({ message: 'Entrada registrada com sucesso!', id_entrada: result.insertId });

    } catch (error) {
        // Em caso de erro, desfaz a transação
        await connection.rollback();
        console.error('Erro ao registrar entrada:', error);
        res.status(500).json({ error: 'Erro ao registrar entrada.' });
    }
});


  /* --------------tabela relatorio------------------*/
app.get('/api/consumos', async (req, res) => {
    try {
        const { startDate, endDate, laboratorio } = req.query;

        let query = `
            SELECT 
                rc.id_consumo, 
                rc.data_consumo, 
                e.sigla, 
                e.nome_produto, 
                l.nome_laboratorio, 
                rc.quantidade, 
                e.tipo_unidade_produto, 
                rc.descricao 
            FROM 
                registro_consumo rc 
            JOIN 
                estoque e 
            ON 
                rc.id_estoque = e.id_estoque 
            JOIN 
                laboratorio l 
            ON 
                rc.id_laboratorio = l.id_laboratorio
        `;

        const params = [];

        if (startDate && endDate) {
            query += ' WHERE rc.data_consumo BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }

        if (laboratorio && laboratorio !== 'todos') {
            query += params.length ? ' AND rc.id_laboratorio = ?' : ' WHERE rc.id_laboratorio = ?';
            params.push(laboratorio);
        }

        query += ' ORDER BY rc.data_consumo DESC;';

        const [consumos] = await connection.execute(query, params);
        res.json(consumos);
    } catch (error) {
        console.error('Erro ao buscar consumos:', error);
        res.status(500).json({ error: 'Erro ao buscar consumos' });
    }
});


 

app.get('/api/siglas', Autenticado, async (req, res) => {
  try {
      const [siglas] = await connection.execute(
          'SELECT id_estoque, sigla FROM estoque'
      );
      res.json(siglas);
  } catch (error) {
      console.error('Erro ao buscar siglas:', error);
      res.status(500).json({ error: 'Erro ao buscar siglas.' });
  }
});

app.delete('/api/excluir-estoque/:idEstoque', Autenticado, async (req, res) => {
  const { idEstoque } = req.params;

  try {
      const [result] = await connection.execute('DELETE FROM estoque WHERE id_estoque = ?', [idEstoque]);
      if (result.affectedRows === 0) {
          return res.status(404).json({ message: 'Estoque não encontrado' });
      }
      res.json({ message: 'Estoque excluído com sucesso' });
  } catch (error) {
      console.error('Erro ao excluir estoque:', error);
      res.status(500).json({ message: 'Erro ao excluir estoque' });
  }
});

// Atualizar o responsável pelo laboratório
app.post('/api/atualizar-responsavel', Autenticado, async (req, res) => {
  const { idLaboratorio, usuarioEmail } = req.body;

  if (!idLaboratorio || !usuarioEmail) {
      return res.status(400).json({ error: 'ID do laboratório e email do responsável são obrigatórios' });
  }

  try {
      // Verificar se o usuário existe
      const [userRows] = await connection.execute('SELECT * FROM usuario WHERE email = ?', [usuarioEmail]);
      if (userRows.length === 0) {
          return res.status(400).json({ error: 'O email do usuário não existe.' });
      }

      // Atualizar o responsável do laboratório
      const [result] = await connection.execute(
          'UPDATE laboratorio SET usuario_email = ? WHERE id_laboratorio = ?',
          [usuarioEmail, idLaboratorio]
      );

      if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'Laboratório não encontrado' });
      }

      res.json({ message: 'Responsável atualizado com sucesso' });
  } catch (error) {
      console.error('Erro ao atualizar responsável:', error);
      res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Obter todos os estoques com paginação
app.get('/api/estoquePag', Autenticado, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  // Converter page e limit para inteiros
  const pageInt = parseInt(page, 10);
  const limitInt = parseInt(limit, 10);

  if (isNaN(pageInt) || isNaN(limitInt)) {
    return res.status(400).json({ error: 'Os parâmetros de página e limite devem ser números inteiros.' });
  }

  const offset = (pageInt - 1) * limitInt;

  try {
    // Consulta com paginação
    const [rows] = await connection.query(`
      SELECT sigla, concentracao, densidade, nome_produto, quantidade, tipo_unidade_produto, ncm
      FROM estoque
      LIMIT ? OFFSET ?`, [limitInt, offset]);

    // Conta o total de registros
    const [countResult] = await connection.query('SELECT COUNT(*) as total FROM estoque');
    const totalItems = countResult[0].total;
    const totalPages = Math.ceil(totalItems / limitInt);

    res.json({
      data: rows,
      totalItems,
      totalPages,
      currentPage: pageInt,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});


app.get('/api/tabelaregistraentradaInico', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT 
        r.id_entrada, 
        r.data_entrada, 
        r.quantidade, 
        e.nome_produto, 
        r.descricao
      FROM registro_entrada r
      JOIN estoque e ON r.id_estoque = e.id_estoque
    `;
    
    const params = [];
    if (startDate && endDate) {
      query += ' WHERE r.data_entrada BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    query += ' ORDER BY r.data_entrada DESC, r.data_entrada ASC';

    const [rows] = await connection.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar registros de entrada:', error);
    res.status(500).json({ error: 'Erro ao buscar registros de entrada' });
  }
});


app.get('/api/tabelaregistraentrada', async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 20 } = req.query;

    const pageInt = parseInt(page, 10);
    const limitInt = parseInt(limit, 10);
    const offset = (pageInt - 1) * limitInt;

    let query = `
      SELECT 
        r.id_entrada, 
        r.data_entrada, 
        r.quantidade, 
        e.nome_produto, 
        r.descricao
      FROM registro_entrada r
      JOIN estoque e ON r.id_estoque = e.id_estoque
    `;
    
    const params = [];
    if (startDate && endDate) {
      query += ' WHERE r.data_entrada BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    query += ' ORDER BY r.data_entrada DESC LIMIT ? OFFSET ?';
    params.push(limitInt, offset);

    const [rows] = await connection.execute(query, params);

    const [countResult] = await connection.query(`
      SELECT COUNT(*) as total 
      FROM registro_entrada r 
      JOIN estoque e ON r.id_estoque = e.id_estoque
      ${startDate && endDate ? 'WHERE r.data_entrada BETWEEN ? AND ?' : ''}
    `, startDate && endDate ? [startDate, endDate] : []);

    const totalItems = countResult[0].total;
    const totalPages = Math.ceil(totalItems / limitInt);

    res.json({
      data: rows,
      totalItems,
      totalPages,
      currentPage: pageInt,
    });
  } catch (error) {
    console.error('Erro ao buscar registros de entrada:', error);
    res.status(500).json({ error: 'Erro ao buscar registros de entrada' });
  }
});


app.get('/api/tabelaregistraConsumo', Autenticado, async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 20 } = req.query;

    const pageInt = parseInt(page, 10);
    const limitInt = parseInt(limit, 10);
    const offset = (pageInt - 1) * limitInt;

    let query = `
      SELECT 
        rc.id_consumo, 
        rc.data_consumo, 
        e.sigla, 
        e.nome_produto, 
        l.nome_laboratorio, 
        rc.quantidade, 
        e.tipo_unidade_produto, 
        rc.descricao 
      FROM 
        registro_consumo rc 
      JOIN 
        estoque e 
      ON 
        rc.id_estoque = e.id_estoque 
      JOIN 
        laboratorio l 
      ON 
        rc.id_laboratorio = l.id_laboratorio
    `;

    const params = [];
    if (startDate && endDate) {
      query += ' WHERE rc.data_consumo BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    query += ' ORDER BY rc.data_consumo DESC LIMIT ? OFFSET ?';
    params.push(limitInt, offset);

    const [rows] = await connection.execute(query, params);

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM registro_consumo rc 
      JOIN laboratorio l ON rc.id_laboratorio = l.id_laboratorio
      ${startDate && endDate ? 'WHERE rc.data_consumo BETWEEN ? AND ?' : ''}
    `;

    const countParams = startDate && endDate ? [startDate, endDate] : [];
    const [countResult] = await connection.query(countQuery, countParams);

    const totalItems = countResult[0].total;
    const totalPages = Math.ceil(totalItems / limitInt);

    res.json({
      data: rows,
      totalItems,
      totalPages,
      currentPage: pageInt,
    });
  } catch (error) {
    console.error('Erro ao buscar registros de entrada:', error);
    res.status(500).json({ error: 'Erro ao buscar registros de entrada' });
  }
});



app.post('/api/filter_records', Autenticado, async (req, res) => {
  try {
      const { startDate, endDate } = req.body; 

      // Verifica se as datas 
      if (!startDate || !endDate) {
          return res.status(400).json({ error: 'Data inicial e final são obrigatórias.' });
      }

      // Consulta para filtrar registros entre as datas
      const query = `
          SELECT r.id_entrada, r.data_entrada, r.quantidade, e.nome_produto, r.descricao
          FROM registro_entrada r
          JOIN estoque e ON r.id_estoque = e.id_estoque
          WHERE r.data_entrada BETWEEN ? AND ?
          ORDER BY r.data_entrada DESC
      `;

      const [rows] = await connection.promise().query(query, [startDate, endDate]);

      res.status(200).json(rows);
  } catch (error) {
      console.error('Erro ao filtrar registros:', error);
      res.status(500).json({ error: 'Erro ao filtrar registros.' });
  }
});

export default app;
