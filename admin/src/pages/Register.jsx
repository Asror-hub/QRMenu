import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { supabase } from "../services/supabase";

const Register = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const cleanedEmail = email.trim().toLowerCase();
    const cleanedName = restaurantName.trim();

    if (!cleanedEmail) {
      setLoading(false);
      setError("Please enter a valid email.");
      return;
    }

    if (!cleanedName) {
      setLoading(false);
      setError("Please enter a restaurant name.");
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: cleanedEmail,
      password
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      setLoading(false);
      setError("Signup failed. Please try again.");
      return;
    }

    const { error: restaurantError } = await supabase.from("restaurants").insert({
      name: cleanedName,
      owner_id: userId
    });

    setLoading(false);

    if (restaurantError) {
      setError(restaurantError.message);
      return;
    }

    navigate("/dashboard");
  };

  return (
    <Shell>
      <Card>
        <Brand>QRMenu Admin</Brand>
        <Title>Create your account</Title>
        <Subtitle>Register and create your restaurant.</Subtitle>
        <Form onSubmit={handleSubmit}>
          <Label>
            Email
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Label>
          <Label>
            Password
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Label>
          <Label>
            Restaurant Name
            <Input
              type="text"
              value={restaurantName}
              onChange={(event) => setRestaurantName(event.target.value)}
              required
            />
          </Label>
          {error && <ErrorText>{error}</ErrorText>}
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Register"}
          </Button>
        </Form>
        <Footer>
          Already have an account? <Link to="/login">Sign in</Link>
        </Footer>
      </Card>
    </Shell>
  );
};

const Shell = styled.div`
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: radial-gradient(circle at top, rgba(99, 102, 241, 0.25), transparent 55%),
    var(--bg);
`;

const Card = styled.div`
  width: min(420px, 100%);
  background: rgba(15, 23, 42, 0.75);
  border-radius: var(--radius-lg);
  padding: 32px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(12px);
`;

const Brand = styled.p`
  margin: 0 0 8px;
  font-weight: 600;
  color: var(--text-soft);
  text-transform: uppercase;
  letter-spacing: 1.2px;
  font-size: 12px;
`;

const Title = styled.h1`
  margin: 0 0 8px;
  font-size: 26px;
`;

const Subtitle = styled.p`
  margin: 0 0 24px;
  color: var(--text-muted);
`;

const Form = styled.form`
  display: grid;
  gap: 16px;
`;

const Label = styled.label`
  display: grid;
  gap: 8px;
  font-size: 14px;
  color: var(--text-soft);
`;

const Input = styled.input`
  background: var(--surface-3);
`;

const Button = styled.button`
  padding: 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: linear-gradient(120deg, var(--primary), var(--primary-strong));
  color: #fff;
  cursor: pointer;
  box-shadow: 0 12px 24px rgba(79, 70, 229, 0.3);
`;

const ErrorText = styled.p`
  margin: 0;
  color: var(--danger);
`;

const Footer = styled.p`
  margin-top: 16px;
  font-size: 14px;
  color: var(--text-muted);
`;

export default Register;
