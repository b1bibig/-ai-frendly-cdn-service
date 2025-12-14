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
      "계정 정보: 이용자 탈퇴 요청 시 즉시 비활성화 후 30일 내 삭제 (법적 보관이 필요한 경우 해당 기간 동안 보관)",
      "접속 로그/IP: 보안 및 감사 목적을 위해 최대 90일 보관 후 파기",
      "업로드 파일: 이용자가 직접 삭제하거나 계정 삭제 시 삭제 대기 상태로 전환 후 30일 내 완전 삭제",
      "백업 데이터: 재해 복구 목적의 스냅샷에 포함될 수 있으며 30일 이내 순차적으로 덮어쓰기 처리",
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
      "요청은 bibigbi83@gmail.com 으로 접수되며, 확인 후 30일 이내 처리합니다.",
    ],
  },
  {
    heading: "7. 데이터 삭제 정책",
    body: [
      "불법 콘텐츠 또는 개인정보 유출 파일 신고 시 검토 후 최대 48시간 내 접근 차단 및 삭제를 진행합니다.",
      "사용자 요청에 따른 일반 데이터 삭제는 확인 완료 시 즉시 삭제 대기 상태로 전환하고 30일 내 영구 삭제합니다.",
      "법령에 따라 보관이 필요한 데이터는 해당 기간 종료 후 즉시 삭제합니다.",
    ],
  },
  {
    heading: "8. 데이터 보존 및 삭제 절차",
    body: [
      "계정 삭제 요청 접수 시 이메일을 통해 본인 확인 후 계정을 비활성화합니다.",
      "비활성화된 계정의 개인정보와 업로드 파일은 30일 내 영구 삭제되며, 이 기간 동안 복구 요청이 없으면 되돌릴 수 없습니다.",
      "법적 의무로 인해 보존해야 하는 데이터(예: 결제/접속 기록)는 관련 법령에서 정한 기간 동안만 별도 분리 보관 후 파기합니다.",
      "재해 복구 백업은 30일 이내 순차적으로 덮어쓰며, 백업 만료 시점 이후에는 동일 데이터가 자동 삭제됩니다.",
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
          <p className="muted">최종 업데이트: 2025-11-29</p>
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
