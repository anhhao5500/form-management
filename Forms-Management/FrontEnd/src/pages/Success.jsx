import { useParams } from "react-router-dom";

export default function Success() {
  const { id } = useParams();

  return (
    <div>
      <h2>Gửi biểu mẫu thành công</h2>
      <hr />

      <p>
        <a
          href={`http://localhost:5000/api/submissions/${id}/pdf`}
          target="_blank"
          rel="noreferrer"
        >
          Tải PDF
        </a>
      </p>

      <h3>Xem trước</h3>
      <iframe
        title="preview"
        src={`http://localhost:5000/api/submissions/${id}/preview`}
        width="100%"
        height="700"
      />
    </div>
  );
}