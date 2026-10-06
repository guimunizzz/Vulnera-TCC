/**
 * team.tsx — o time do TCC, com foto e link de LinkedIn.
 *
 * Portado de `vulnera-landing/src/components/sections/Team.jsx`.
 * As fotos vieram junto para `src/assets/landing/team/`.
 */

import { Linkedin } from "lucide-react";
import { Reveal, GlitchHeading } from "../ui";
import rafaelPhoto from "../../../assets/landing/team/rafael.jpg";
import guilhermePhoto from "../../../assets/landing/team/guilherme.jpg";
import iannPhoto from "../../../assets/landing/team/iann.jpg";

const TEAM = [
  {
    name: "Rafael",
    photo: rafaelPhoto,
    linkedin: "https://www.linkedin.com/in/rafael-augusto-barros-51a919233/",
    role: "Tech Lead & Scrum Master",
    bio: "Lidera a arquitetura de segurança do produto: quem acessa o quê, como cada ação fica auditada, e o que acontece se algo sair do lugar.",
    specialty: "Arquitetura & Segurança",
  },
  {
    name: "Guilherme",
    photo: guilhermePhoto,
    linkedin: "https://www.linkedin.com/in/guilherme-muniz-claro/",
    role: "Back-end",
    bio: "Constrói a base que sustenta o Vulnera com segurança em primeiro lugar: dados protegidos, acessos validados, nada exposto por acidente.",
    specialty: "Back-end & Segurança",
  },
  {
    name: "Iann",
    photo: iannPhoto,
    linkedin: "https://www.linkedin.com/in/iannarthur/",
    role: "Front-end",
    bio: "Garante que cada tela mostre só o que cada perfil — admin, pentester ou cliente — tem permissão de ver.",
    specialty: "Front-end & Segurança",
  },
];

export default function Team() {
  return (
    <section id="equipe" className="vx-grid-bg flex min-h-screen items-center bg-[var(--vx-bg)] px-6 py-24">
      <div className="mx-auto w-full max-w-5xl">
        <Reveal className="text-center">
          <p className="font-mono text-sm tracking-widest text-[var(--vx-accent)]">{"// QUEM CONSTRÓI"}</p>
          <GlitchHeading className="mt-4 text-3xl font-bold text-[var(--vx-text)] md:text-4xl">
            O time por trás do Vulnera.
          </GlitchHeading>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {TEAM.map((member, i) => (
            <Reveal key={member.name} delay={i * 150}>
              <div className="flex h-full flex-col rounded-[6px] border border-[rgba(var(--vx-accent-rgb),0.15)] bg-[var(--vx-bg-2)] p-8 text-center transition-all duration-[300ms] hover:border-[rgba(var(--vx-accent-rgb),0.4)] hover:shadow-[0_0_24px_rgba(var(--vx-accent-rgb),0.12)]">
                <img
                  src={member.photo}
                  alt={member.name}
                  className="mx-auto h-20 w-20 rounded-full border border-[rgba(var(--vx-accent-rgb),0.3)] object-cover"
                />
                <h3 className="mt-5 text-lg font-bold">
                  <a
                    href={member.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Ver perfil de ${member.name} no LinkedIn`}
                    className="group inline-flex items-center gap-[6px] text-[var(--vx-text)] transition-colors hover:text-[var(--vx-accent)]"
                  >
                    {member.name}
                    <Linkedin
                      size={14}
                      className="text-[var(--vx-text-3)] transition-colors group-hover:text-[var(--vx-accent)]"
                      aria-hidden="true"
                    />
                  </a>
                </h3>
                <p className="mt-1 font-mono text-xs tracking-wide text-[var(--vx-accent)]">{member.role}</p>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-[var(--vx-text-2)]">{member.bio}</p>
                <p className="mt-6 font-mono text-xs text-[var(--vx-text-2)]">
                  Especialidade: <span className="text-[var(--vx-accent-soft)]">{member.specialty}</span>
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
