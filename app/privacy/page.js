export const metadata = {
  title: "개인정보 처리방침 | app.zcxv.xyz",
};

const sections = [
  {
    heading: "1. 수집하는 개인정보 항목",
    body: [
      "이메일(회원가입)",
      "비밀번호 해시(암호화 저장)",
      "업로드 파일 경로, 파일명, 업로드 시간",
      "접속 IP / 브라우저 로그(API 보안 목적)",
    ],
  },
  {
    heading: "2. 개인정보 수집 목적",
    body: [
      "회원 인증 및 로그인",
      "파일 저장 및 공유 기능 제공",
      "서비스 악용·불법 사용 방지",
      "보안 모니터링 및 안정화",
    ],
  },
  {
    heading: "3. 개인정보 보관 기간",
    body: [
      "계정 정보: 탈퇴 시까지",
      "접속 로그/IP: 최대 90일",
      "업로드 파일: 이용자가 삭제하거나 계정 삭제 시까지",
    ],
  },
  {
    heading: "4. 개인정보의 제3자 제공",
    body: [
      "Supabase: 인증 및 데이터베이스",
      "Bunny CDN: 파일 저장/전송",
      "Vercel: 웹 앱 호스팅",
      "위탁 서비스는 서비스 운영에 필수적인 최소 정보만 처리합니다.",
    ],
  },
  {
    heading: "5. 개인정보 보호 조치",
    body: [
      "비밀번호는 원문 저장 없이 해시 처리",
      "HTTPS 암호화 적용",
      "DB 접근 최소 권한 원칙",
      "정기적인 로그 점검",
    ],
  },
  {
    heading: "6. 이용자의 권리",
    body: [
      "계정/개인정보 열람 및 수정 요청",
      "계정 삭제 요청",
      "데이터 삭제 요청",
      "요청은 bibigbi83@gmail.com 으로 접수됩니다.",
    ],
  },
  {
    heading: "7. 데이터 삭제 정책",
    body: [
      "불법 콘텐츠 또는 개인정보 유출 파일은 신고 시 즉시 삭제됩니다.",
      "운영자는 신고 후 최대 48시간 내 처리합니다.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="legal-page">
      <div className="panel stack gap-lg">
        <div>
          <div className="eyebrow">app.zcxv.xyz 개인정보 처리방침</div>
          <h2 className="title">개인정보 처리방침</h2>
          <p className="muted">최종 업데이트: YYYY-MM-DD</p>
        </div>

        <div className="stack gap-lg">
          {sections.map((section) => (
            <section key={section.heading} className="stack gap-sm">
              <h3 className="title">{section.heading}</h3>
              <ul className="legal-list">
                {section.body.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="muted">문의 / 신고: bibigbi83@gmail.com</p>
      </div>
    </div>
  );
}
