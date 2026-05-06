const db = require("../config/db");
const puppeteer = require("puppeteer");

// ================= HELPERS =================
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ================= 1. SUBMIT =================
exports.submitForm = (req, res) => {
  const { form_id, user_id, data, values } = req.body;
  if (!form_id || !user_id)
    return res.status(400).json({ message: "Thiếu form_id hoặc user_id" });

  db.transaction((err, connection) => {
    if (err) return res.status(500).json({ error: "Lỗi giao dịch" });

    connection.query(
      "INSERT INTO form_submissions (form_id, user_id, submitted_at, form_values, status) VALUES (?,?,NOW(),?,'submitted')",
      [form_id, user_id, JSON.stringify(values || {})],
      (errS, result) => {
        if (errS) return connection.rollback(() => {
          connection.release();
          res.status(500).json({ error: "Lỗi lưu đơn: " + errS.message });
        });

        const submissionId = result.insertId;

        // Log tương tác
        db.query(
          "INSERT INTO user_form_interactions (user_id, form_id, action, interacted_at) VALUES (?,?,'submit',NOW())",
          [user_id, form_id]
        );

        if (!Array.isArray(data) || !data.length) {
          return connection.commit((errC) => {
            connection.release();
            if (errC) return res.status(500).json({ error: "Lỗi commit" });
            res.json({ message: "Thành công", submission_id: submissionId });
          });
        }

        const detailValues = data.map((item) => [
          submissionId,
          item.field_id,
          item.value ?? "",
        ]);

        connection.query(
          "INSERT INTO submission_data (submission_id, field_id, value) VALUES ?",
          [detailValues],
          (errD) => {
            if (errD) return connection.rollback(() => {
              connection.release();
              res.status(500).json({ error: "Lỗi lưu chi tiết: " + errD.message });
            });

            connection.commit((errC) => {
              connection.release();
              if (errC) return res.status(500).json({ error: "Lỗi commit" });
              res.json({ message: "Thành công!", submission_id: submissionId });
            });
          }
        );
      }
    );
  });
};

// ================= 2. DETAIL =================
exports.getSubmissionDetail = (req, res) => {
  const id = req.params.id.replace(":", "");
  const sql = `
    SELECT 
      fs.submission_id,
      fs.form_values,
      fs.submitted_at,
      f.template_html,
      f.template_pdf,
      f.title,
      u.full_name,
      u.email
    FROM form_submissions fs
    JOIN forms f ON fs.form_id = f.form_id
    JOIN users u ON fs.user_id = u.user_id
    WHERE fs.submission_id = ?
  `;

  db.query(sql, [id], (err, rows) => {
    if (err || !rows.length)
      return res.status(404).json({ message: "Không tìm thấy đơn" });

    const row = rows[0];
    let parsedValues = {};
    try { parsedValues = JSON.parse(row.form_values || "{}"); } catch {}

    res.json({
      info: {
        title: row.title,
        template_html: row.template_html,
        template_pdf: row.template_pdf,
        full_name: row.full_name,
        email: row.email,
        submitted_at: row.submitted_at,
      },
      rawData: parsedValues,
    });
  });
};

// ================= 3. EXPORT PDF =================
exports.exportPDF = (req, res) => {
  const id = req.params.id.replace(":", "");

  db.query(
    `SELECT f.form_id, f.title, f.template_html, fs.form_values
     FROM form_submissions fs
     JOIN forms f ON fs.form_id = f.form_id
     WHERE fs.submission_id = ?`,
    [id],
    async (err, rows) => {
      if (err || !rows.length) return res.status(404).send("Không tìm thấy");

      const row = rows[0];
      let data = {};
      try { data = JSON.parse(row.form_values || "{}"); } catch {}

      if (!row.template_html)
        return res.status(400).send("Không có template HTML");

      try {
        let filled = row.template_html;

        filled = filled.replace(
          /<input[^>]*name="([^"]*)"[^>]*\/?>/gi,
          (match, fieldName) => {
            const value = escapeHtml(data[fieldName] || "");
            const widthMatch = match.match(/width:\s*([\d.]+px)/);
            const minWidthMatch = match.match(/min-width:\s*([\d.]+px)/);
            const width = widthMatch
              ? widthMatch[1]
              : minWidthMatch ? minWidthMatch[1] : "120px";
            return `<span style="border-bottom:1px dotted #000;display:inline-block;width:${width};padding:0 4px;font-family:inherit;font-size:inherit;vertical-align:baseline;">${value || "........"}</span>`;
          }
        );

        filled = filled.replace(
          /<textarea[^>]*name="([^"]*)"[^>]*>(.*?)<\/textarea>/gis,
          (match, fieldName) => {
            const value = escapeHtml(data[fieldName] || "");
            return `<span style="border-bottom:1px dotted #000;display:inline-block;min-width:120px;padding:0 4px;font-family:inherit;font-size:inherit;">${value || "........"}</span>`;
          }
        );

        const browser = await puppeteer.launch({
          headless: "new",
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        const page = await browser.newPage();

        await page.setContent(
          `<!DOCTYPE html>
           <html>
             <head>
               <meta charset="utf-8"/>
               <style>
                 body { margin: 0; padding: 0; }
                 @page { size: A4; margin: 15mm 20mm; }
               </style>
             </head>
             <body>${filled}</body>
           </html>`,
          { waitUntil: "networkidle0" }
        );

        const pdf = await page.pdf({
          format: "A4",
          printBackground: true,
          margin: { top: "15mm", bottom: "15mm", left: "20mm", right: "20mm" },
        });

        await browser.close();
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="bieu-mau-${id}.pdf"`
        );
        res.send(pdf);
      } catch (e) {
        res.status(500).send("Lỗi xuất PDF: " + e.message);
      }
    }
  );
};

// ================= 4. ADMIN LIST =================
exports.getAllSubmissions = (req, res) => {
  db.query(
    `SELECT fs.submission_id, fs.submitted_at, u.full_name, u.email, 
            f.title AS form_title
     FROM form_submissions fs
     JOIN forms f ON fs.form_id = f.form_id
     JOIN users u ON fs.user_id = u.user_id
     ORDER BY fs.submitted_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
};

// ================= 5. USER HISTORY =================
exports.getUserHistory = (req, res) => {
  db.query(
    `SELECT fs.submission_id, fs.submitted_at, f.title AS form_title
     FROM form_submissions fs
     JOIN forms f ON fs.form_id = f.form_id
     WHERE fs.user_id = ?
     ORDER BY fs.submitted_at DESC`,
    [req.params.userId],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
};

// ================= 6. UPDATE =================
exports.updateSubmission = (req, res) => {
  const id = req.params.id.replace(":", "");
  const { values, data } = req.body;

  db.transaction((err, connection) => {
    if (err) return res.status(500).json({ error: "Lỗi giao dịch" });

    connection.query(
      "UPDATE form_submissions SET form_values=?, submitted_at=NOW() WHERE submission_id=?",
      [JSON.stringify(values || {}), id],
      (errU) => {
        if (errU) return connection.rollback(() => {
          connection.release();
          res.status(500).json({ error: "Lỗi update" });
        });

        connection.query(
          "DELETE FROM submission_data WHERE submission_id=?",
          [id],
          (errD) => {
            if (errD) return connection.rollback(() => {
              connection.release();
              res.status(500).json({ error: "Lỗi delete" });
            });

            if (Array.isArray(data) && data.length) {
              const vals = data.map((i) => [id, i.field_id, i.value || ""]);
              connection.query(
                "INSERT INTO submission_data (submission_id, field_id, value) VALUES ?",
                [vals],
                (errI) => {
                  if (errI) return connection.rollback(() => {
                    connection.release();
                    res.status(500).json({ error: "Lỗi insert" });
                  });
                  connection.commit((errC) => {
                    connection.release();
                    if (errC) return res.status(500).json({ error: "Lỗi commit" });
                    res.json({ message: "Cập nhật thành công" });
                  });
                }
              );
            } else {
              connection.commit((errC) => {
                connection.release();
                if (errC) return res.status(500).json({ error: "Lỗi commit" });
                res.json({ message: "Cập nhật thành công" });
              });
            }
          }
        );
      }
    );
  });
};

// ================= 7. VIEW HISTORY =================
exports.getViewerHistory = (req, res) => {
  const id = req.params.id.replace(":", "");
  db.query(
    `SELECT svh.viewed_at, u.full_name, u.email
     FROM submission_view_history svh
     JOIN users u ON svh.user_id = u.user_id
     WHERE svh.submission_id = ?
     ORDER BY svh.viewed_at DESC`,
    [id],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
};

exports.clearViewerHistory = (req, res) => {
  const id = req.params.id.replace(":", "");
  db.query(
    "DELETE FROM submission_view_history WHERE submission_id=?",
    [id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Đã xoá lịch sử xem" });
    }
  );
};

// ================= 8. DELETE =================
exports.deleteSubmission = (req, res) => {
  const id = req.params.id.replace(":", "");

  db.transaction((err, connection) => {
    if (err) return res.status(500).json({ error: "Lỗi giao dịch" });

    connection.query(
      "DELETE FROM submission_data WHERE submission_id = ?",
      [id],
      (errD) => {
        if (errD) return connection.rollback(() => {
          connection.release();
          res.status(500).json({ error: "Lỗi xóa chi tiết" });
        });

        connection.query(
          "DELETE FROM submission_view_history WHERE submission_id = ?",
          [id],
          (errV) => {
            if (errV) return connection.rollback(() => {
              connection.release();
              res.status(500).json({ error: "Lỗi xóa lịch sử" });
            });

            connection.query(
              "DELETE FROM form_submissions WHERE submission_id = ?",
              [id],
              (errS) => {
                if (errS) return connection.rollback(() => {
                  connection.release();
                  res.status(500).json({ error: "Lỗi xóa đơn" });
                });

                connection.commit((errC) => {
                  connection.release();
                  if (errC) return res.status(500).json({ error: "Lỗi commit" });
                  res.json({ message: "Đã xóa thành công" });
                });
              }
            );
          }
        );
      }
    );
  });
};