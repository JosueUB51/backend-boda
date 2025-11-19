import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
app.use(cors());
app.use(express.json());

// 👇 montamos http server sobre express
const httpServer = createServer(app);

// 👇 socket.io con CORS abierto
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

// Conexión MySQL (Railway)
const db = await mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT,
});

// 👉 Crear invitación
app.post("/api/invitaciones", async (req, res) => {
  try {
    const { abrev, nombre, pases } = req.body;

    const [result] = await db.execute(
      "INSERT INTO invitacion (abrev, nombre, pases, qrs, confirmacion, link) VALUES (?, ?, ?, ?, ?, ?)",
      [abrev, nombre, pases, "-", "pendiente", "-"]
    );

    const id = result.insertId;
    const link = `https://maricelayhugo2025.com/invitacion/${id}`;

    await db.execute("UPDATE invitacion SET link=? WHERE id=?", [link, id]);

    const nuevo = {
      id,
      abrev,
      nombre,
      pases,
      qrs: "-",
      confirmacion: "pendiente",
      link,
    };

    io.emit("invitacion-nueva", nuevo);
    res.json(nuevo);
  } catch (err) {
    res.status(500).json({ error: "Error creando invitación" });
  }
});

// 👉 Obtener invitación
app.get("/api/invitaciones/:id", async (req, res) => {
  const [rows] = await db.execute("SELECT * FROM invitacion WHERE id=?", [
    req.params.id,
  ]);
  if (rows.length === 0) return res.status(404).json({ error: "No existe" });
  res.json(rows[0]);
});

// 👉 Obtener TODOS los invitados
app.get("/api/invitados", async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT id, abrev, nombre, pases, qrs, confirmacion, link FROM invitacion"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error listando invitados" });
  }
});

// 👉 Obtener UN invitado por ID
app.get("/api/invitados/:id", async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT id, abrev, nombre, pases, qrs, confirmacion, link FROM invitacion WHERE id=?",
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Invitado no encontrado" });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo invitado" });
  }
});

// 👉 Confirmar asistencia
app.put("/api/invitaciones/:id/confirmar", async (req, res) => {
  try {
    const { id } = req.params;
    const { confirmacion, pases } = req.body;

    const pasesFinal = confirmacion === "no_asistira" ? 0 : pases;

    await db.execute(
      "UPDATE invitacion SET confirmacion=?, pases=? WHERE id=?",
      [confirmacion, pasesFinal, id]
    );

    const [rows] = await db.execute("SELECT * FROM invitacion WHERE id=?", [id]);

    io.emit("invitacion-actualizada", rows[0]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error confirmando asistencia" });
  }
});

// Sockets
io.on("connection", (socket) => {
  console.log("🟢 Cliente conectado:", socket.id);
});

// Puerto dinámico para Railway
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () =>
  console.log(`Servidor en puerto ${PORT}`)
);
