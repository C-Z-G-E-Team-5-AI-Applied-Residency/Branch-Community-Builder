// Contact page (BR-49): where the About page's "contact us" line and the
// header/footer Contact links land — GitHub repo link plus each team
// member's LinkedIn and email.
import { Link } from "react-router-dom";

const GITHUB_REPO_URL = "https://github.com/C-Z-G-E-Team-5-AI-Applied-Residency/Branch-Community-Builder";

const TEAM = [
  { name: "Gabriel Cervantes", linkedin: "https://www.linkedin.com/in/gabriel-cervantes", email: "Gabecervantes407@gmail.com" },
  { name: "Christopher Hackett", linkedin: "https://www.linkedin.com/in/christopher-hackett4/", email: "christopherhackett20@gmail.com" },
  { name: "Zane Correa", linkedin: "https://www.linkedin.com/in/samzcorrea/", email: "zenithzsc@gmail.com" },
  { name: "Emily Vu", linkedin: "https://www.linkedin.com/in/emilyvuu", email: "evu725@gmail.com" },
];

export default function Contact() {
  return (
    <main className="contact-page">
      <h1>Contact Us</h1>
      <p>
        Questions, feedback, or something not working right? Reach out to any of us below, or
        check out the code on GitHub.
      </p>

      <p>
        <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
          View the repo on GitHub &rarr;
        </a>
      </p>

      <div className="team-grid">
        {TEAM.map((member) => (
          <div className="team-member" key={member.name}>
            <h3>{member.name}</h3>
            <p>
              <a href={member.linkedin} target="_blank" rel="noopener noreferrer">
                LinkedIn
              </a>
            </p>
            <p>
              <a href={`mailto:${member.email}`}>{member.email}</a>
            </p>
          </div>
        ))}
      </div>

      <p>
        <Link to="/about">&larr; Back to About</Link>
      </p>
    </main>
  );
}
