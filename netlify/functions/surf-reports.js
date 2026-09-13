import { getDatabase } from "@netlify/database";

export default async (request) => {
  const db = getDatabase();

  try {
    if (request.method === "GET") {
      const reports = await db.sql`
        SELECT
          id,
          wave_height,
          wave_shape,
          crowd,
          created_at
        FROM surf_reports
        ORDER BY created_at DESC
        LIMIT 20
      `;

      return new Response(JSON.stringify(reports), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    if (request.method === "POST") {
      const body = await request.json();

      const waveHeight = Number(body.waveHeight);
      const waveShape = String(body.waveShape || "");
      const crowd = String(body.crowd || "");

      if (!Number.isFinite(waveHeight) || !waveShape || !crowd) {
        return new Response(
          JSON.stringify({
            error: "Invalid surf report.",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      const [report] = await db.sql`
        INSERT INTO surf_reports (
          wave_height,
          wave_shape,
          crowd
        )
        VALUES (
          ${waveHeight},
          ${waveShape},
          ${crowd}
        )
        RETURNING
          id,
          wave_height,
          wave_shape,
          crowd,
          created_at
      `;

      return new Response(JSON.stringify(report), {
        status: 201,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    return new Response(
      JSON.stringify({
        error: "Method not allowed.",
      }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Surf reports error:", error);

    return new Response(
      JSON.stringify({
        error: "Could not access surf reports.",
        details: error.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};
