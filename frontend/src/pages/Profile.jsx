// User profile: display name, bio, interests, community standing / leader badge.
import { useParams } from "react-router-dom";
export default function Profile() {
  const { userId } = useParams();
  return <main><h1>Profile {userId}</h1>{/* TODO: api.getProfile */}</main>;
}
