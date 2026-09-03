import { NextRequest, NextResponse } from "next/server";
import { 
  listSurveyLinks, 
  saveSurveyLink, 
  listSessions, 
  listReports, 
  logAuditAccess 
} from "@/lib/ai/storage-mysql";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get("adminId") || undefined;

    const [links, sessions, reports] = await Promise.all([
      listSurveyLinks(adminId),
      listSessions(),
      listReports()
    ]);

    const linksWithStats = links.map((link) => {
      const linkSessions = sessions.filter((s) => s.profile?.linkId === link.id || s.linkId === link.id);
      const linkReports = reports.filter((r) => r.profile?.linkId === link.id || r.linkId === link.id);
      return {
        ...link,
        totalSessions: linkSessions.length,
        completedReports: linkReports.length,
        lastResponseAt: linkSessions[0]?.createdAt || link.createdAt,
      };
    });

    return NextResponse.json(linksWithStats);
  } catch (err: any) {
    console.error("Erro ao listar links de pesquisa:", err);
    return NextResponse.json(
      { error: "Erro ao listar links de pesquisa." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, sector, role, quantity, adminName, adminEmail, adminId } = body;

    if (!title || !String(title).trim()) {
      return NextResponse.json(
        { error: "Título do link / campanha é obrigatório." },
        { status: 400 }
      );
    }

    const qty = Math.max(1, Math.min(parseInt(quantity, 10) || 1, 200));
    const batchId = qty > 1 ? `batch_${Math.random().toString(36).substring(2, 10)}` : null;
    const cleanSector = sector || "all";
    const cleanRole = role?.trim() || null;
    const cleanAdminName = adminName?.trim() || "Gestor do Setor";
    const cleanAdminEmail = adminEmail?.trim() || "";

    const createdLinks = [];

    for (let i = 0; i < qty; i++) {
      const linkId = `lnk_${Math.random().toString(36).substring(2, 10)}`;
      const linkTitle = qty > 1 
        ? `${String(title).trim()} • #${i + 1}${cleanRole ? ` (${cleanRole})` : ""}`
        : String(title).trim();

      const newLink = {
        id: linkId,
        title: linkTitle,
        sector: cleanSector,
        role: cleanRole,
        adminId: adminId || null,
        adminName: cleanAdminName,
        adminEmail: cleanAdminEmail,
        batchId,
        active: true,
        used: false,
      };

      const saved = await saveSurveyLink(newLink);
      createdLinks.push(saved);
    }

    await logAuditAccess({
      action: qty > 1 ? "SURVEY_LINKS_BATCH_CREATED" : "SURVEY_LINK_CREATED",
      targetId: batchId || createdLinks[0].id,
      performedBy: cleanAdminName,
      sector: cleanSector,
      details: `${qty} link(s) de pesquisa gerado(s) para o setor "${cleanSector}"${cleanRole ? ` e cargo "${cleanRole}"` : ""}. Total: ${qty}.`,
    });

    return NextResponse.json({
      success: true,
      count: createdLinks.length,
      batchId,
      link: createdLinks[0],
      links: createdLinks,
    });
  } catch (err: any) {
    console.error("Erro ao criar link(s) de pesquisa:", err);
    return NextResponse.json(
      { error: "Erro ao criar link(s) de pesquisa." },
      { status: 500 }
    );
  }
}
